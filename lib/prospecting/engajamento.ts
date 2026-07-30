import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * Sinais de engajamento de PRIMEIRA PARTE.
 *
 * O Apollo diz quem a pessoa é: cargo, empresa, porte, se a empresa está contratando. Não diz — e
 * não pode dizer — se ela abriu a mensagem, se clicou, se leu a proposta até o fim. Esse segundo
 * conjunto é o que separa "cabe no perfil" de "está interessado agora", e é a diferença entre
 * abordar 50 pessoas plausíveis e abordar as 5 que já demonstraram atenção.
 *
 * Estes sinais são gerados pela interação da pessoa CONOSCO. Não há termo de uso de terceiro em
 * jogo, não há dado comprado: é o nosso próprio e-mail sendo aberto, o nosso próprio link sendo
 * clicado, a nossa própria proposta sendo lida.
 *
 * ── Decaimento ────────────────────────────────────────────────────────────────────────────────
 * Todo sinal perde valor com o tempo, com meia-vida de 30 dias (o `exp(-0.0231·dias)` da função
 * `fn_engajamento_score`). Isso não é refinamento estatístico: sem decaimento, quem abriu um
 * e-mail em janeiro apareceria em julho tão "quente" quanto quem clicou ontem, e a fila de
 * abordagem passaria a ordenar por antiguidade em vez de por interesse.
 *
 * ── Pesos ─────────────────────────────────────────────────────────────────────────────────────
 * Deliberadamente assimétricos. Abrir e-mail é quase ruído — cliente de e-mail abre imagem
 * sozinho, firewall corporativo faz pré-fetch. Clicar exige uma decisão. Marcar reunião é a
 * decisão inteira. O peso reflete quanta intenção o gesto realmente carrega.
 */

export const PESO: Record<TipoSinal, number> = {
  email_aberto: 3,        // pode ser o cliente de e-mail, não a pessoa
  link_clicado: 12,       // decidiu clicar
  agenda_aberta: 25,      // abriu a página de agendamento: intenção declarada
  proposta_vista: 20,
  proposta_secao: 6,      // leu uma seção específica — soma quando lê várias
  proposta_aprovada: 60,
  respondeu: 40,
  reuniao_marcada: 70,
  entregavel_visto: 15,
  site_visitou: 10,
  whatsapp_respondeu: 35,
  descadastrou: -100,     // não é engajamento negativo: é fim de conversa

  /**
   * Sinais do LinkedIn — só de posts com tema de IA, e só dos posts do próprio André.
   *
   * Pesam alto porque dizem duas coisas de uma vez: a pessoa se interessa pelo tema E já conhece
   * quem escreveu. Comentar vale mais que curtir (escrever exige mais que clicar), e compartilhar
   * vale mais que comentar — quem compartilha coloca o próprio nome junto.
   */
  curtiu_post_ia: 18,
  comentou_post_ia: 35,
  compartilhou_post_ia: 45,
  publica_sobre_ia: 30,      // a própria pessoa publica sobre o tema
  empresa_contrata_ia: 20,   // vaga aberta na área — a empresa está investindo
  empresa_usa_ia: 12,        // pilha tecnológica indica adoção

  /**
   * Mensagem que a pessoa mandou para o André. Pesa alto e por bom motivo: escrever direto é o
   * gesto mais deliberado que existe antes de marcar reunião — mais que curtir, mais que comentar
   * em público. Sobre IA, vale ainda mais.
   *
   * O sinal é por PESSOA, não por mensagem: uma conversa de vinte mensagens é um contato, não
   * vinte.
   */
  mensagem_recebida: 30,
  mensagem_sobre_ia: 50,
};

export type TipoSinal =
  | "email_aberto" | "link_clicado" | "agenda_aberta" | "proposta_vista" | "proposta_secao"
  | "proposta_aprovada" | "respondeu" | "reuniao_marcada" | "entregavel_visto" | "site_visitou"
  | "whatsapp_respondeu" | "descadastrou"
  | "curtiu_post_ia" | "comentou_post_ia" | "compartilhou_post_ia"
  | "publica_sobre_ia" | "empresa_contrata_ia" | "empresa_usa_ia"
  | "mensagem_recebida" | "mensagem_sobre_ia";

/** Os sinais que indicam afinidade com o TEMA, não com a gente. Alimentam `afinidade_ia`. */
export const SINAIS_DE_TEMA: TipoSinal[] = [
  "curtiu_post_ia", "comentou_post_ia", "compartilhou_post_ia",
  "publica_sobre_ia", "empresa_contrata_ia", "empresa_usa_ia", "mensagem_sobre_ia",
];

/** Rótulo humano — usado na timeline e na tela do prospect. Nada de nome técnico na interface. */
export const ROTULO: Record<TipoSinal, string> = {
  email_aberto: "abriu o e-mail",
  link_clicado: "clicou num link",
  agenda_aberta: "abriu a agenda",
  proposta_vista: "abriu a proposta",
  proposta_secao: "leu uma parte da proposta",
  proposta_aprovada: "aprovou a proposta",
  respondeu: "respondeu",
  reuniao_marcada: "marcou reunião",
  entregavel_visto: "abriu um material",
  site_visitou: "visitou o site",
  whatsapp_respondeu: "respondeu no WhatsApp",
  descadastrou: "pediu para não receber mais",
  curtiu_post_ia: "curtiu um post seu sobre IA",
  comentou_post_ia: "comentou um post seu sobre IA",
  compartilhou_post_ia: "compartilhou um post seu sobre IA",
  publica_sobre_ia: "publica sobre IA",
  empresa_contrata_ia: "a empresa está contratando para IA",
  empresa_usa_ia: "a empresa usa ferramentas de IA",
  mensagem_recebida: "mandou mensagem para você",
  mensagem_sobre_ia: "mandou mensagem sobre IA",
};

/**
 * Grava um sinal. O peso é gravado JUNTO, não só o tipo: se os pesos forem recalibrados amanhã,
 * o histórico continua explicando por que aquele prospect tinha o score que tinha na época.
 *
 * Nunca lança — sinal é enriquecimento. Perder um sinal é aceitável; derrubar o envio de um
 * e-mail ou a abertura de uma proposta por causa dele, não.
 */
export async function registrarSinal(opts: {
  tipo: TipoSinal;
  prospectId?: string | null;
  contactId?: string | null;
  detalhe?: Record<string, unknown>;
  fonte?: string;
}): Promise<void> {
  if (!opts.prospectId && !opts.contactId) return;
  try {
    const sb = createServiceClient();
    await sb.from("engagement_events").insert({
      prospect_id: opts.prospectId ?? null,
      contact_id: opts.contactId ?? null,
      tipo: opts.tipo,
      peso: PESO[opts.tipo] ?? 0,
      fonte: opts.fonte ?? "ai-os",
      detalhe: opts.detalhe ?? null,
    });
  } catch (e) {
    console.error(`[engajamento] sinal ${opts.tipo} não gravado:`, (e as Error).message);
  }
}

/**
 * Cria o link rastreado. O destino fica NO BANCO, não na URL.
 *
 * Passar a URL de destino como parâmetro (`/r?u=https://…`) transformaria o AI OS num
 * redirecionador aberto — qualquer um poderia usar o nosso domínio para mandar gente a um site de
 * phishing, com a nossa reputação emprestada. Token opaco → destino guardado resolve isso: só
 * redireciona para onde nós mesmos gravamos.
 */
export async function linkRastreado(opts: {
  destino: string; prospectId?: string | null; contactId?: string | null;
  messageId?: string | null; rotulo?: string;
}): Promise<string | null> {
  if (!/^https?:\/\//i.test(opts.destino)) return null;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("engagement_links").insert({
      destino: opts.destino, prospect_id: opts.prospectId ?? null,
      contact_id: opts.contactId ?? null, message_id: opts.messageId ?? null,
      rotulo: opts.rotulo ?? null,
    }).select("token").single();
    if (error || !data) return null;
    return `${baseUrl()}/api/e/${data.token}/l`;
  } catch {
    return null;
  }
}

/** Pixel de abertura. Devolve string vazia se não deu para criar — nunca um <img> quebrado. */
export async function pixelAbertura(opts: {
  prospectId?: string | null; contactId?: string | null; messageId?: string | null;
}): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("engagement_links").insert({
      destino: `${baseUrl()}/pixel`,           // não é usado; a linha existe para carregar o vínculo
      prospect_id: opts.prospectId ?? null, contact_id: opts.contactId ?? null,
      message_id: opts.messageId ?? null, rotulo: "pixel",
    }).select("token").single();
    if (!data) return "";
    return `<img src="${baseUrl()}/api/e/${data.token}/a" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  } catch {
    return "";
  }
}

/**
 * Reescreve os links de um corpo de e-mail para passarem pelo rastreio.
 *
 * Só links http(s). `mailto:` e âncora ficam intactos, e o link de DESCADASTRO nunca é reescrito:
 * quem está saindo não deve ter o clique medido — seria medir exatamente a pessoa que pediu para
 * não ser mais observada.
 */
export async function rastrearLinks(corpo: string, opts: {
  prospectId?: string | null; contactId?: string | null; messageId?: string | null;
}): Promise<string> {
  const urls = [...new Set(corpo.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [])];
  let saida = corpo;
  for (const url of urls) {
    if (url.includes("/descadastro/")) continue;
    const rastreado = await linkRastreado({ destino: url, ...opts, rotulo: rotuloDoLink(url) });
    if (rastreado) saida = saida.split(url).join(rastreado);
  }
  return saida;
}

/** Um link de agenda clicado vale muito mais que um link qualquer — o tipo do sinal vem daqui. */
function rotuloDoLink(url: string): string {
  if (/calendly|agenda|meet|cal\.com/i.test(url)) return "agenda";
  return "link";
}

/**
 * Encontra o prospect por trás de uma proposta.
 *
 * A proposta aponta para o negócio; o prospect é quem virou aquele negócio. Sem esta ponte, ler
 * uma proposta — que é dos sinais mais fortes que existem — não chegaria ao score de ninguém.
 */
export async function prospectDoDeal(dealId: string | null | undefined): Promise<string | null> {
  if (!dealId) return null;
  const sb = createServiceClient();
  const { data } = await sb.from("prospects").select("id").eq("deal_id", dealId).limit(1).maybeSingle();
  return (data?.id as string) ?? null;
}

/** Mesma ponte, pelo contato: usada quando o sinal chega por e-mail em vez de por negócio. */
export async function prospectDoEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const sb = createServiceClient();
  const { data } = await sb.from("prospects").select("id").ilike("email", email.trim()).limit(1).maybeSingle();
  return (data?.id as string) ?? null;
}

export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://ai-os-sable.vercel.app";
}

/** Leitura da fila quente: quem demonstrou atenção recentemente, do mais quente para o menos. */
export type ProspectQuente = {
  id: string; nome: string; empresa: string | null; email: string | null;
  score: number; engajamento: number; ultimoEm: string | null; ultimoSinal: string | null;
};

export async function filaQuente(limite = 20): Promise<ProspectQuente[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("prospects")
    .select("id, name, email, score, engajamento, ultimo_engajamento_em, prospect_accounts(name)")
    .gt("engajamento", 0).is("deal_id", null).is("oposicao_em", null)
    .order("engajamento", { ascending: false }).limit(limite);

  const ids = (data ?? []).map((p) => p.id as string);
  const ultimos = new Map<string, string>();
  if (ids.length) {
    const { data: evs } = await sb.from("engagement_events")
      .select("prospect_id, tipo, occurred_at").in("prospect_id", ids)
      .order("occurred_at", { ascending: false });
    for (const e of evs ?? []) {
      const k = e.prospect_id as string;
      if (!ultimos.has(k)) ultimos.set(k, e.tipo as string);
    }
  }

  return (data ?? []).map((p) => ({
    id: p.id, nome: p.name, email: p.email, score: p.score, engajamento: p.engajamento,
    empresa: (p.prospect_accounts as unknown as { name: string } | null)?.name ?? null,
    ultimoEm: p.ultimo_engajamento_em,
    ultimoSinal: ultimos.get(p.id as string) ?? null,
  }));
}

/** Recalcula o engajamento de todos — o decaimento é contínuo, o número gravado não. */
export async function recalcularEngajamento(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.from("prospects")
    .select("id").gt("engajamento", 0).limit(1000);
  let n = 0;
  for (const p of data ?? []) {
    const { data: novo } = await sb.rpc("fn_engajamento_score", { p_prospect: p.id });
    await sb.from("prospects").update({ engajamento: novo ?? 0 }).eq("id", p.id);
    n++;
  }
  if (n) await auditService("prospeccao.engajamento.recalculado", "prospects", undefined, { prospects: n });
  return n;
}
