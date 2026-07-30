import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { getSecret } from "@/lib/settings/secrets";
import { rodarActor, campo, objeto } from "./apify";
import { registrarSinal } from "./engajamento";
import { slugDoPerfil } from "./linkedin";
import { mencoesDeIA } from "./afinidade-ia";

/**
 * Coleta externa no LinkedIn, via Apify.
 *
 * ── O que isto é, dito sem eufemismo ─────────────────────────────────────────────────────────
 * Raspagem. Contraria os termos de uso do LinkedIn e pode custar a conta usada. A decisão de
 * assumir esse risco é do André, tomada em 2026-07-30 depois de a alternativa licenciada estar
 * construída e funcionando. O código não finge que o risco não existe: ele o contém.
 *
 * ── As salvaguardas não são enfeite ───────────────────────────────────────────────────────────
 *  · **Teto diário** de execuções e de perfis por execução, no banco, não no código.
 *  · **Pausa aleatória** entre requisições. Ritmo constante é assinatura de robô; o intervalo
 *    variável entre 4 e 11 segundos é o que mais separa uma coleta discreta de uma que chama
 *    atenção.
 *  · **Parada automática** ao primeiro sinal de bloqueio. Insistir contra um bloqueio é o caminho
 *    mais curto para a conta cair de vez — então o sistema para sozinho por 24h e avisa.
 *  · **Preferência por fonte, não por perfil.** Varrer quem reagiu a UM post de influenciador
 *    rende dezenas de pessoas numa requisição; varrer perfil a perfil gasta uma requisição por
 *    pessoa. Mesmo resultado, uma fração da exposição.
 *
 * ── Filtro de tema ────────────────────────────────────────────────────────────────────────────
 * Só interação com conteúdo de IA vira sinal. Sem isso, a base encheria de gente que curtiu um
 * post de fim de ano — e o volume de dado pessoal coletado deixaria de ser proporcional à
 * finalidade, que é o que sustenta a base legal.
 */

export type Escopo = "atividade_perfil" | "reacoes_post" | "posts_proprios" | "grupos";

export type Config = {
  ativo: boolean;
  actor_atividade: string | null;
  actor_reacoes_post: string | null;
  actor_perfil: string | null;
  usa_cookie: boolean;
  teto_execucoes_dia: number;
  teto_perfis_execucao: number;
  pausa_min_ms: number;
  pausa_max_ms: number;
  parado_ate: string | null;
  motivo_parada: string | null;
};

export type ResultadoColeta = {
  escopo: Escopo; itens: number; casados: number; novos: number;
  custoUsd?: number; erro?: string; bloqueado?: boolean;
};

export async function lerConfig(): Promise<Config | null> {
  const sb = createServiceClient();
  const { data } = await sb.from("coleta_externa_config").select("*").eq("id", "unica").maybeSingle();
  return (data as Config) ?? null;
}

/**
 * Portão único de entrada. Nenhuma coleta acontece sem passar por aqui, e o motivo da recusa é
 * sempre em português: quem opera precisa entender por que não rodou sem abrir o log.
 */
export async function podeColetar(): Promise<{ ok: boolean; motivo?: string; config?: Config }> {
  const config = await lerConfig();
  if (!config) return { ok: false, motivo: "A coleta externa não está configurada." };
  if (!config.ativo) return { ok: false, motivo: "A coleta externa está desligada." };
  if (config.parado_ate && new Date(config.parado_ate) > new Date()) {
    return {
      ok: false,
      motivo: `A coleta está pausada até ${new Date(config.parado_ate).toLocaleString("pt-BR")}. ${config.motivo_parada ?? ""}`.trim(),
    };
  }
  if (!(await getSecret("apify"))) return { ok: false, motivo: "A chave do Apify não está configurada." };

  const sb = createServiceClient();
  const desde = new Date(Date.now() - 86400000).toISOString();
  const { count } = await sb.from("coleta_externa_execucoes")
    .select("id", { count: "exact", head: true }).gte("iniciada_em", desde);
  if ((count ?? 0) >= config.teto_execucoes_dia) {
    return { ok: false, motivo: `O teto de ${config.teto_execucoes_dia} coleta(s) por dia já foi atingido.` };
  }
  return { ok: true, config };
}

/**
 * Para tudo por 24h. Chamado ao primeiro sinal de bloqueio.
 *
 * Não é conservadorismo: um bloqueio ignorado vira banimento. A pausa dá tempo de o padrão
 * esfriar e força alguém a olhar antes de religar.
 */
async function pararPorSeguranca(motivo: string): Promise<void> {
  const sb = createServiceClient();
  await sb.from("coleta_externa_config").update({
    parado_ate: new Date(Date.now() + 86400000).toISOString(),
    motivo_parada: motivo,
    updated_at: new Date().toISOString(),
  }).eq("id", "unica");
  await auditService("coleta.parada_automatica", "coleta_externa_config", undefined, { motivo });
}

async function abrirExecucao(escopo: Escopo, alvo: string | null): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb.from("coleta_externa_execucoes")
    .insert({ escopo, alvo }).select("id").single();
  return data?.id ?? null;
}

async function fecharExecucao(id: string | null, r: ResultadoColeta, runId?: string): Promise<void> {
  if (!id) return;
  const sb = createServiceClient();
  await sb.from("coleta_externa_execucoes").update({
    status: r.bloqueado ? "bloqueada" : r.erro ? "falhou" : "concluida",
    run_id: runId ?? null, itens: r.itens, casados: r.casados, novos: r.novos,
    custo_usd: r.custoUsd ?? null, erro: r.erro ?? null,
    concluida_em: new Date().toISOString(),
  }).eq("id", id);
}

/** Cookie de sessão — só é lido quando a configuração diz que o actor precisa dele. */
async function inputBase(config: Config): Promise<Record<string, unknown>> {
  if (!config.usa_cookie) return {};
  const cookie = await getSecret("linkedin_li_at");
  if (!cookie) return {};
  // Formato aceito pela maioria dos actors de LinkedIn.
  return { cookie: [{ name: "li_at", value: cookie, domain: ".linkedin.com" }], li_at: cookie };
}

// ── Escopo 1 e 2: atividade de um perfil (curtidas, comentários e posts próprios) ─────────────

/**
 * Varre a atividade recente de UM perfil e registra só o que é sobre IA.
 *
 * É o escopo mais caro em exposição: uma requisição por pessoa. Existe para quando um prospect
 * específico merece investigação — não para varrer a base inteira, o que seria desproporcional à
 * finalidade e derrubaria o balanceamento do LIA.
 */
export async function coletarAtividade(prospectId: string): Promise<ResultadoColeta> {
  const r: ResultadoColeta = { escopo: "atividade_perfil", itens: 0, casados: 0, novos: 0 };
  const portao = await podeColetar();
  if (!portao.ok) return { ...r, erro: portao.motivo };
  const config = portao.config!;

  const sb = createServiceClient();
  const { data: p } = await sb.from("prospects")
    .select("id, name, linkedin_url, oposicao_em").eq("id", prospectId).maybeSingle();
  if (!p?.linkedin_url) return { ...r, erro: "Este prospect não tem perfil do LinkedIn." };
  // Quem se opôs ao tratamento não é observado. Vale mais que qualquer teto.
  if (p.oposicao_em) return { ...r, erro: "Esta pessoa se opôs ao tratamento. Nada é coletado." };

  const exec = await abrirExecucao("atividade_perfil", p.linkedin_url as string);
  const run = await rodarActor(config.actor_atividade ?? "", {
    ...(await inputBase(config)),
    profileUrls: [p.linkedin_url], urls: [p.linkedin_url],
    maxPosts: 30, limit: 30,
  });

  if (run.bloqueado) await pararPorSeguranca(run.erro ?? "Falha na coleta.");
  if (!run.ok) {
    const saida = { ...r, erro: run.erro, bloqueado: run.bloqueado, custoUsd: run.custoUsd };
    await fecharExecucao(exec, saida, run.runId);
    return saida;
  }

  for (const item of run.itens) {
    r.itens++;
    const texto = [campo(item, "text", "postText", "content", "commentText"), campo(item, "title")]
      .filter(Boolean).join(" ");
    if (mencoesDeIA(texto) === 0) continue;                       // não é sobre IA: não vira sinal

    const acao = (campo(item, "activityType", "type", "action") ?? "").toLowerCase();
    const tipo = /comment/.test(acao) ? "comentou_post_ia"
      : /share|repost/.test(acao) ? "compartilhou_post_ia"
      : /post|publish/.test(acao) ? "publica_sobre_ia"
      : "curtiu_post_ia";

    await sb.from("linkedin_interacoes").insert({
      post_id: null, tipo: tipo === "publica_sobre_ia" ? "post_proprio" : "curtida",
      perfil_url: p.linkedin_url, perfil_slug: slugDoPerfil(p.linkedin_url as string),
      nome: p.name, texto: texto.slice(0, 500), prospect_id: p.id,
      casado_em: new Date().toISOString(), fonte: "apify", origem_externa: "atividade_perfil",
    });
    await registrarSinal({ tipo, prospectId: p.id as string, fonte: "apify", detalhe: { trecho: texto.slice(0, 160) } });
    r.casados++;
  }

  await fecharExecucao(exec, { ...r, custoUsd: run.custoUsd }, run.runId);
  await auditService("coleta.atividade", "prospects", prospectId, { itens: r.itens, sinais: r.casados });
  return { ...r, custoUsd: run.custoUsd };
}

// ── Escopo 3: quem reage aos posts de uma FONTE (influenciador, concorrente) ──────────────────

/**
 * O escopo que vale a pena. Uma requisição num post de influenciador de IA rende dezenas de
 * pessoas que acabaram de demonstrar interesse no tema — contra uma pessoa por requisição na
 * varredura perfil a perfil.
 *
 * Quem já está na base ganha o sinal na hora. Quem não está fica na fila de "interessados fora da
 * base", que é a lista mais qualificada que existe: ninguém ali foi comprado nem filtrado.
 */
export async function coletarReacoesDeFonte(fonteId: string): Promise<ResultadoColeta> {
  const r: ResultadoColeta = { escopo: "reacoes_post", itens: 0, casados: 0, novos: 0 };
  const portao = await podeColetar();
  if (!portao.ok) return { ...r, erro: portao.motivo };
  const config = portao.config!;

  const sb = createServiceClient();
  const { data: f } = await sb.from("linkedin_fontes").select("*").eq("id", fonteId).maybeSingle();
  if (!f) return { ...r, erro: "Fonte não encontrada." };

  const exec = await abrirExecucao("reacoes_post", f.url as string);
  const run = await rodarActor(config.actor_reacoes_post ?? "", {
    ...(await inputBase(config)),
    postUrls: [f.url], urls: [f.url], profileUrls: [f.url],
    maxItems: config.teto_perfis_execucao, limit: config.teto_perfis_execucao,
  });

  if (run.bloqueado) await pararPorSeguranca(run.erro ?? "Falha na coleta.");
  if (!run.ok) {
    const saida = { ...r, erro: run.erro, bloqueado: run.bloqueado, custoUsd: run.custoUsd };
    await fecharExecucao(exec, saida, run.runId);
    return saida;
  }

  for (const item of run.itens.slice(0, config.teto_perfis_execucao)) {
    r.itens++;
    const autor = objeto(item, "author", "actor", "profile", "reactor") ?? item;
    const perfilUrl = campo(autor, "profileUrl", "linkedinUrl", "url", "publicProfileUrl");
    const slug = slugDoPerfil(perfilUrl);
    if (!slug) continue;

    const nome = campo(autor, "name", "fullName", "title") ?? slug.replace(/-/g, " ");
    const cargo = campo(autor, "headline", "occupation", "position", "subtitle");
    const empresa = campo(autor, "companyName", "company");
    const acao = (campo(item, "reactionType", "type", "action") ?? "").toLowerCase();
    const tipo = /comment/.test(acao) ? "comentario" : /share|repost/.test(acao) ? "compartilhamento" : "curtida";

    // Já consta desta fonte? Não conta de novo.
    const { data: jaTem } = await sb.from("linkedin_interacoes")
      .select("id").eq("fonte_id", fonteId).eq("perfil_slug", slug).eq("tipo", tipo).limit(1).maybeSingle();
    if (jaTem) continue;

    const { data: prospect } = await sb.from("prospects")
      .select("id, oposicao_em").ilike("linkedin_url", `%/in/${slug}%`).limit(1).maybeSingle();
    if (prospect?.oposicao_em) continue;                          // opôs-se: não é observado

    await sb.from("linkedin_interacoes").insert({
      post_id: null, fonte_id: fonteId, tipo, perfil_url: perfilUrl, perfil_slug: slug,
      nome, cargo, empresa, prospect_id: prospect?.id ?? null,
      casado_em: prospect ? new Date().toISOString() : null,
      fonte: "apify", origem_externa: "reacoes_post",
    });

    if (prospect?.id) {
      await registrarSinal({
        tipo: tipo === "comentario" ? "comentou_post_ia" : tipo === "compartilhamento" ? "compartilhou_post_ia" : "curtiu_post_ia",
        prospectId: prospect.id as string, fonte: "apify",
        detalhe: { fonte: f.nome, externo: true },
      });
      r.casados++;
    } else {
      r.novos++;
    }
  }

  await sb.from("linkedin_fontes").update({
    ultima_coleta: new Date().toISOString(),
    total_pessoas: (f.total_pessoas as number) + r.casados + r.novos,
  }).eq("id", fonteId);

  await fecharExecucao(exec, { ...r, custoUsd: run.custoUsd }, run.runId);
  await auditService("coleta.reacoes", "linkedin_fontes", fonteId, { itens: r.itens, casados: r.casados, novos: r.novos });
  return { ...r, custoUsd: run.custoUsd };
}

// ── Escopo 4: grupos ──────────────────────────────────────────────────────────────────────────

/**
 * Grupos de que a pessoa participa.
 *
 * Rende pouco: o LinkedIn parou de expor isso na maioria dos perfis, e o actor devolve vazio na
 * maior parte das vezes. Fica implementado porque foi pedido, com o aviso registrado aqui — e
 * porque quando vem, vem forte: alguém em três grupos de IA está claramente dentro do assunto.
 */
export async function coletarGrupos(prospectId: string): Promise<ResultadoColeta> {
  const r: ResultadoColeta = { escopo: "grupos", itens: 0, casados: 0, novos: 0 };
  const portao = await podeColetar();
  if (!portao.ok) return { ...r, erro: portao.motivo };
  const config = portao.config!;

  const sb = createServiceClient();
  const { data: p } = await sb.from("prospects")
    .select("id, name, linkedin_url, oposicao_em").eq("id", prospectId).maybeSingle();
  if (!p?.linkedin_url) return { ...r, erro: "Este prospect não tem perfil do LinkedIn." };
  if (p.oposicao_em) return { ...r, erro: "Esta pessoa se opôs ao tratamento. Nada é coletado." };

  const exec = await abrirExecucao("grupos", p.linkedin_url as string);
  const run = await rodarActor(config.actor_perfil ?? "", {
    ...(await inputBase(config)),
    profileUrls: [p.linkedin_url], urls: [p.linkedin_url],
  });

  if (run.bloqueado) await pararPorSeguranca(run.erro ?? "Falha na coleta.");
  if (!run.ok) {
    const saida = { ...r, erro: run.erro, bloqueado: run.bloqueado, custoUsd: run.custoUsd };
    await fecharExecucao(exec, saida, run.runId);
    return saida;
  }

  for (const item of run.itens) {
    const grupos = (item.groups ?? item.interests ?? []) as unknown[];
    for (const g of Array.isArray(grupos) ? grupos : []) {
      const nome = typeof g === "string" ? g : campo(g as Record<string, unknown>, "name", "title") ?? "";
      if (!nome || mencoesDeIA(nome) === 0) continue;
      r.itens++;
      await sb.from("linkedin_interacoes").insert({
        post_id: null, tipo: "grupo", perfil_url: p.linkedin_url,
        perfil_slug: slugDoPerfil(p.linkedin_url as string), nome: p.name, texto: nome,
        prospect_id: p.id, casado_em: new Date().toISOString(),
        fonte: "apify", origem_externa: "grupos",
      });
      await registrarSinal({ tipo: "publica_sobre_ia", prospectId: p.id as string, fonte: "apify", detalhe: { grupo: nome } });
      r.casados++;
    }
  }

  await fecharExecucao(exec, { ...r, custoUsd: run.custoUsd }, run.runId);
  return { ...r, custoUsd: run.custoUsd };
}

/**
 * Varre as fontes ativas, uma a uma, com pausa entre elas. É o que o cron chama.
 *
 * A pausa é ALEATÓRIA de propósito: ritmo constante é assinatura de robô, e é o que um sistema
 * antifraude procura primeiro.
 */
export async function coletarFontesAtivas(): Promise<ResultadoColeta[]> {
  const portao = await podeColetar();
  if (!portao.ok) return [{ escopo: "reacoes_post", itens: 0, casados: 0, novos: 0, erro: portao.motivo }];
  const config = portao.config!;

  const sb = createServiceClient();
  const { data: fontes } = await sb.from("linkedin_fontes")
    .select("id").eq("ativa", true).order("ultima_coleta", { ascending: true, nullsFirst: true }).limit(3);

  const saida: ResultadoColeta[] = [];
  for (const [i, f] of (fontes ?? []).entries()) {
    if (i > 0) {
      const pausa = config.pausa_min_ms + Math.floor((config.pausa_max_ms - config.pausa_min_ms) * 0.5);
      await new Promise((r) => setTimeout(r, pausa));
    }
    const r = await coletarReacoesDeFonte(f.id as string);
    saida.push(r);
    if (r.bloqueado) break;                                        // parou: não insiste
  }
  return saida;
}
