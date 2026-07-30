import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { apolloConfigured, apolloSearchPeople, apolloEnrichPerson, apolloVagasDaEmpresa, type ApolloPerson } from "@/lib/apollo";
import { scoreProspect, scoreAccount } from "@/lib/prospecting/score";
import { registrarBaseProspeccao } from "@/lib/lgpd/consentimento";
import { emailCorporativo } from "@/lib/lgpd/corporativo";

/**
 * Coleta automatizada de prospects por fonte licenciada (Apollo).
 *
 * Por que Apollo e não coleta própria no LinkedIn: raspar perfis com a conta do André contraria os
 * termos da plataforma, e conta bloqueada não volta. O Apollo é o caminho licenciado — era o
 * "plano B" previsto no §8 do plano mestre, e virou o plano A. O modelo de dados não muda com a
 * troca de fonte, então nada aqui fica preso a esse fornecedor.
 *
 * O que este motor NÃO faz, e não vai fazer por esta via: sinais de engajamento (post, comentário,
 * curtida). O Apollo não expõe isso. O que ele expõe — cargo, senioridade, porte, setor e **vagas
 * abertas** — diz mais sobre timing de compra do que uma curtida diria.
 *
 * Três coisas que o desenho protege, nesta ordem:
 *
 *  1. **Crédito pago.** Enriquecer consome crédito do Apollo. Toda busca tem teto por execução, e
 *     só se enriquece quem já passou nos filtros — nunca antes.
 *  2. **A base legal.** Só entra dado corporativo, e cada prospect novo grava a base de tratamento
 *     junto (legítimo interesse para prospecção, marketing negado).
 *  3. **A paginação.** A busca guarda em que página parou. Sem isso, toda execução traria as
 *     mesmas 25 pessoas e a coleta nunca avançaria.
 */

export type Busca = {
  id: string; nome: string; icp: string | null;
  cargos: string[]; senioridades: string[]; setores: string[]; locais: string[]; porte: string[];
  palavras_chave: string | null;
  meta_por_execucao: number; teto_enriquecimento: number;
  campaign_id: string | null; ultima_pagina: number;
};

export type ResultadoColeta = {
  busca: string; vistos: number; criados: number; duplicados: number;
  recusadosPessoal: number; enriquecidos: number; erro?: string;
};

const PER_PAGE = 25;

/** Executa UMA busca. Isolada de propósito: uma busca que falha não derruba as outras. */
export async function executarBusca(busca: Busca): Promise<ResultadoColeta> {
  const sb = createServiceClient();
  const base: ResultadoColeta = {
    busca: busca.nome, vistos: 0, criados: 0, duplicados: 0, recusadosPessoal: 0, enriquecidos: 0,
  };

  const { data: exec } = await sb.from("prospect_busca_execucoes")
    .insert({ busca_id: busca.id }).select("id").single();

  if (!(await apolloConfigured())) {
    const erro = "Chave do Apollo não configurada.";
    await fecharExecucao(exec?.id, base, erro);
    await sb.from("prospect_buscas").update({ ultimo_erro: erro }).eq("id", busca.id);
    return { ...base, erro };
  }

  try {
    let pagina = (busca.ultima_pagina ?? 0) + 1;
    let enriquecidosRestantes = busca.teto_enriquecimento;

    while (base.vistos < busca.meta_por_execucao) {
      const pessoas = await apolloSearchPeople({
        titles: busca.cargos, seniorities: busca.senioridades,
        locations: busca.locais, industries: busca.setores,
        employeeRanges: busca.porte, keywords: busca.palavras_chave ?? undefined,
        perPage: PER_PAGE, page: pagina,
      });

      // Fim do resultado: volta à primeira página na próxima execução. A base do Apollo muda com
      // o tempo, então recomeçar traz gente nova — e o dedupe cuida de quem já está aqui.
      if (pessoas.length === 0) { pagina = 0; break; }

      for (const p of pessoas) {
        if (base.vistos >= busca.meta_por_execucao) break;
        base.vistos++;
        const r = await gravarProspect(p, busca, enriquecidosRestantes > 0);
        if (r.resultado === "criado") base.criados++;
        else if (r.resultado === "duplicado") base.duplicados++;
        else if (r.resultado === "pessoal") base.recusadosPessoal++;
        if (r.enriqueceu) { base.enriquecidos++; enriquecidosRestantes--; }
      }
      pagina++;
    }

    await sb.from("prospect_buscas").update({
      ultima_execucao: new Date().toISOString(),
      ultima_pagina: pagina,
      total_coletado: (await totalDaBusca(busca.id)),
      ultimo_erro: null,
      updated_at: new Date().toISOString(),
    }).eq("id", busca.id);

    await fecharExecucao(exec?.id, base);
    await auditService("prospeccao.coleta", "prospect_buscas", busca.id, { ...base, via: "apollo" });
    return base;
  } catch (e) {
    const erro = (e as Error).message;
    await fecharExecucao(exec?.id, base, erro);
    await sb.from("prospect_buscas").update({ ultimo_erro: erro }).eq("id", busca.id);
    console.error(`[coleta] busca "${busca.nome}" falhou:`, erro);
    return { ...base, erro };
  }
}

type Gravacao = { resultado: "criado" | "duplicado" | "pessoal" | "ignorado"; enriqueceu: boolean };

async function gravarProspect(p: ApolloPerson, busca: Busca, podeEnriquecer: boolean): Promise<Gravacao> {
  const sb = createServiceClient();
  if (!p.name) return { resultado: "ignorado", enriqueceu: false };

  // Dedupe ANTES de enriquecer: gastar crédito com quem já está na base é dinheiro no lixo.
  if (p.apollo_id) {
    const { data: dup } = await sb.from("prospects").select("id").eq("apollo_id", p.apollo_id).limit(1).maybeSingle();
    if (dup) return { resultado: "duplicado", enriqueceu: false };
  }
  if (p.email) {
    const { data: dup } = await sb.from("prospects").select("id").ilike("email", p.email).limit(1).maybeSingle();
    if (dup) return { resultado: "duplicado", enriqueceu: false };
  }

  /**
   * A busca NÃO entrega dado utilizável: sobrenome ofuscado, e-mail nulo, domínio ausente. Só o
   * `people/match` pelo `apollo_id` devolve o registro real — e é ele que cobra crédito.
   *
   * Duas economias que importam, nesta ordem:
   *  · `hasEmail` — a busca já diz se existe e-mail do outro lado. Enriquecer quem não tem é
   *    crédito jogado fora, e crédito gasto não volta.
   *  · o dedupe acima — quem já está na base não é enriquecido de novo.
   */
  if (!p.hasEmail) return { resultado: "ignorado", enriqueceu: false };
  if (!podeEnriquecer) return { resultado: "ignorado", enriqueceu: false };
  if (!p.apollo_id) return { resultado: "ignorado", enriqueceu: false };

  const rico = await apolloEnrichPerson({ apolloId: p.apollo_id });
  const enriqueceu = true;
  if (!rico) return { resultado: "ignorado", enriqueceu };

  const email = rico.email;
  const telefone = rico.phone;
  // Sem e-mail não há como abordar, e guardar o dado de quem não se pode contatar não tem
  // finalidade — o que, sob legítimo interesse, é exatamente o que não se pode fazer.
  if (!email) return { resultado: "ignorado", enriqueceu };
  if (!emailCorporativo(email)) return { resultado: "pessoal", enriqueceu };

  // Agora sim há e-mail real: vale checar duplicidade outra vez antes de gravar.
  {
    const { data: dup } = await sb.from("prospects").select("id").ilike("email", email).limit(1).maybeSingle();
    if (dup) return { resultado: "duplicado", enriqueceu };
  }

  // O registro enriquecido tem o nome completo e o domínio que a busca mascarou. Ele manda.
  const completo: ApolloPerson = {
    ...p,
    name: rico.name ?? p.name,
    title: rico.title ?? p.title,
    seniority: rico.seniority ?? p.seniority,
    linkedin_url: rico.linkedin_url ?? p.linkedin_url,
    org_name: rico.org_name ?? p.org_name,
    domain: rico.domain ?? p.domain,
  };

  const accountId = await upsertConta(completo, busca);
  const { data: acc } = accountId
    ? await sb.from("prospect_accounts").select("*").eq("id", accountId).single()
    : { data: null };

  const linha = {
    account_id: accountId, name: completo.name, title: completo.title, seniority: completo.seniority,
    icp: busca.icp, email, phone: telefone, linkedin_url: completo.linkedin_url, apollo_id: completo.apollo_id,
    source: "apollo", procedencia: "coleta_publica", busca_id: busca.id, status: "novo",
  };
  const { error } = await sb.from("prospects").insert({ ...linha, score: scoreProspect(linha, acc) });
  if (error) {
    // O gatilho do banco é a última linha de defesa; se ele recusou, respeitamos e seguimos.
    if (/corporativo/i.test(error.message)) return { resultado: "pessoal", enriqueceu };
    throw new Error(error.message);
  }

  await registrarBaseProspeccao({ email, telefone, origem: "Apollo (base de terceiro)" });
  return { resultado: "criado", enriqueceu };
}

/** Localiza ou cria a conta-alvo por domínio, e busca as vagas abertas como sinal. */
async function upsertConta(p: ApolloPerson, busca: Busca): Promise<string | null> {
  const sb = createServiceClient();
  const dom = p.domain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase() ?? null;
  if (dom) {
    const { data } = await sb.from("prospect_accounts").select("id").ilike("domain", dom).limit(1).maybeSingle();
    if (data) return data.id;
  }
  const linha = {
    name: p.org_name ?? dom ?? p.name, domain: dom, icp: busca.icp,
    industry: null, size: null, signals: [] as string[], source: "apollo",
  };
  const { data } = await sb.from("prospect_accounts")
    .insert({ ...linha, score: scoreAccount(linha) }).select("id").single();
  return data?.id ?? null;
}

/**
 * Enriquece contas com vagas abertas. Roda separado da coleta e depois dela: é sinal, não é
 * requisito, e uma falha aqui não pode custar a coleta que já deu certo.
 */
export async function coletarSinaisDeVagas(limite = 20): Promise<number> {
  const sb = createServiceClient();
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: contas } = await sb.from("prospect_accounts")
    .select("id, apollo_id, signals, sinais_em")
    .not("apollo_id", "is", null)
    .or(`sinais_em.is.null,sinais_em.lt.${seteDiasAtras}`)
    .limit(limite);

  let atualizadas = 0;
  for (const c of contas ?? []) {
    try {
      const vagas = await apolloVagasDaEmpresa(c.apollo_id as string);
      const anteriores = ((c.signals as string[] | null) ?? []).filter((s) => !s.startsWith("vaga:"));
      const novos = vagas.slice(0, 5).map((v) => `vaga:${v.titulo}`);
      await sb.from("prospect_accounts").update({
        signals: [...anteriores, ...novos], sinais_em: new Date().toISOString(),
      }).eq("id", c.id);
      atualizadas++;
    } catch (e) {
      console.error(`[coleta] sinais da conta ${c.id} falharam:`, (e as Error).message);
    }
  }
  if (atualizadas) await auditService("prospeccao.sinais", "prospect_accounts", undefined, { atualizadas });
  return atualizadas;
}

/** Executa todas as buscas ativas. É o que o cron chama. */
export async function executarBuscasAtivas(): Promise<ResultadoColeta[]> {
  const sb = createServiceClient();
  const { data: buscas } = await sb.from("prospect_buscas")
    .select("id, nome, icp, cargos, senioridades, setores, locais, porte, palavras_chave, meta_por_execucao, teto_enriquecimento, campaign_id, ultima_pagina")
    .eq("ativa", true).is("deleted_at", null);

  const saida: ResultadoColeta[] = [];
  for (const b of (buscas ?? []) as Busca[]) saida.push(await executarBusca(b));
  await coletarSinaisDeVagas();
  return saida;
}

async function totalDaBusca(buscaId: string): Promise<number> {
  const sb = createServiceClient();
  const { count } = await sb.from("prospects").select("id", { count: "exact", head: true }).eq("busca_id", buscaId);
  return count ?? 0;
}

async function fecharExecucao(id: string | undefined, r: ResultadoColeta, erro?: string): Promise<void> {
  if (!id) return;
  const sb = createServiceClient();
  await sb.from("prospect_busca_execucoes").update({
    concluida_em: new Date().toISOString(),
    vistos: r.vistos, criados: r.criados, duplicados: r.duplicados,
    recusados_pessoal: r.recusadosPessoal, enriquecidos: r.enriquecidos,
    erro: erro ?? null,
  }).eq("id", id);
}
