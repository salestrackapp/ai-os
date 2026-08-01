import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgentCore } from "@/lib/agents/runner";
import { auditService } from "@/lib/audit";
import { linkDescadastro } from "@/lib/lgpd/consentimento";
import { getSalesOffer } from "@/lib/settings";
import { ICP_LABELS } from "./types";
import { EMAIL_ENCARREGADO, NOME_ENCARREGADO, urlDireitos } from "@/lib/lgpd/contato";

/** Guardrails da doutrina comercial — aplicados a TODOS os agentes de prospecção. */
export const PROSPECT_GUARDRAILS = `
REGRAS INVIOLÁVEIS (doutrina comercial da Salestrack):
- Prospecção por SINAL e inteligência, nunca por volume ou spam.
- O PROSPECT é o protagonista: os primeiros toques abrem pela DOR do decisor, SEM oferecer serviço. A solução só aparece depois, quando houver interesse.
- COLD (frio): simples, direto, profissional; SEM jargão de agência; NÃO cite a marca "Salestrack" no primeiro toque — quem lidera a abordagem fria é a marca pessoal ANDRÉ KACHAN. Um ÚNICO CTA de baixa fricção (ex.: um link de agenda). Sem emojis em e-mail frio.
- WARM / indicado: curto, conversacional, aberto por PERGUNTA — diálogo, não pitch.
- NUNCA invente fatos, números, cargos, rodadas ou notícias que não estejam no contexto. Se faltar dado, escreva de forma honesta e genérica.
- ICP1: CEOs/Founders de empresas médias · ICP2: gestores de Vendas+Marketing em PME · ICP3: diretores de Operações+Finanças em enterprise.
- Português brasileiro, tom executivo e humano.`;

type Ctx = { prospect: Record<string, unknown>; account: Record<string, unknown> | null; text: string };

async function buildProspectContext(prospectId: string): Promise<Ctx | null> {
  const sb = createServiceClient();
  const { data: p } = await sb.from("prospects").select("*").eq("id", prospectId).single();
  if (!p) return null;
  const { data: acc } = p.account_id ? await sb.from("prospect_accounts").select("*").eq("id", p.account_id).single() : { data: null };
  const signals = Array.isArray(acc?.signals) ? (acc!.signals as string[]) : [];
  const parts = [
    `Prospect: ${p.name}${p.title ? `, ${p.title}` : ""}${p.seniority ? ` (${p.seniority})` : ""}`,
    `Empresa: ${acc?.name ?? "—"}${acc?.industry ? ` · ${acc.industry}` : ""}${acc?.size ? ` · porte ${acc.size}` : ""}`,
    `ICP: ${p.icp ? ICP_LABELS[p.icp as string] ?? p.icp : "não definido"}`,
    signals.length ? `Sinais/gatilhos detectados: ${signals.join(", ")}` : "Sinais: nenhum registrado.",
    p.dossier_md ? `Dossiê:\n${p.dossier_md}` : "",
  ].filter(Boolean);
  return { prospect: p, account: acc ?? null, text: parts.join("\n") };
}

/** prospect_intel — monta o dossiê do decisor (contexto, dores por ICP, ganchos). Grava em prospects.dossier_md. */
export async function generateDossier(prospectId: string): Promise<{ ok: boolean; degraded: boolean }> {
  const ctx = await buildProspectContext(prospectId);
  if (!ctx) return { ok: false, degraded: false };
  const offer = await getSalesOffer();
  const r = await runAgentCore({
    agentKey: "prospect_intel", guardrails: PROSPECT_GUARDRAILS, extraContext: `${ctx.text}\n\n=== O QUE A SALESTRACK ENTREGA (para orientar dores e ganchos relevantes) ===\n${offer}`, contextLabel: "DADOS DO PROSPECT (CRM Salestrack)", maxTokens: 900,
    userMessages: [{ role: "user", content: "Monte um dossiê objetivo deste decisor: (1) contexto provável do papel e da empresa; (2) 2–3 dores prováveis para o ICP dele que a Salestrack resolve; (3) 2 ganchos de abertura pela dor (sem oferecer serviço). Use SÓ o que está no contexto; onde faltar, seja genérico e honesto. Markdown enxuto." }],
  });
  if (r.degraded) return { ok: false, degraded: true };
  const sb = createServiceClient();
  await sb.from("prospects").update({ dossier_md: r.text }).eq("id", prospectId);
  await auditService("prospect.dossier", "prospects", prospectId, { tokens: r.tokens }, undefined);
  return { ok: true, degraded: false };
}

/** prospect_writer — gera o toque (rascunho) encodificando a doutrina. Salva em outreach_messages status=rascunho. */
/**
 * O rodapé de transparência entra nesta mensagem?
 *
 * Exportado, e não escondido dentro do gerador, porque é uma obrigação legal e obrigação legal
 * precisa ser testável sem subir banco nem chamar modelo. As três condições: o dado veio de coleta
 * (não de quem procurou a gente), há e-mail para onde mandar a via de oposição, e a pessoa ainda
 * não foi avisada DE FATO — ver `deveCarimbarAviso` para o que "de fato" quer dizer.
 */
export function deveEscreverRodape(p: { procedencia: string | null; email: string | null; avisoEm: string | null }): boolean {
  const coletado = ["coleta_publica", "terceiro"].includes(p.procedencia ?? "");
  return coletado && !p.avisoEm && !!p.email;
}

export async function generateOutreach(prospectId: string, opts?: { warm?: boolean; channel?: string; modelo?: string; agendaUrl?: string }): Promise<{ id: string | null; degraded: boolean }> {
  const ctx = await buildProspectContext(prospectId);
  if (!ctx) return { id: null, degraded: false };
  const warm = !!opts?.warm;
  const channel = opts?.channel ?? "email";
  const agenda = opts?.agendaUrl ?? process.env.AGENDA_URL ?? "[seu link de agenda]";
  /**
   * A DURAÇÃO precisa vir junto com o link. Sem ela o modelo escolhe um número plausível —
   * o primeiro rascunho que geramos oferecia "20 minutos" e apontava para uma agenda de 60.
   * O prospect clica esperando 20 e encontra 60: a mensagem perde credibilidade antes da
   * conversa começar. Prometer o que o calendário cumpre é o mínimo.
   */
  const duracaoMin = Number(process.env.AGENDA_DURACAO_MIN ?? 0) || null;
  const offer = await getSalesOffer();
  const brief = [
    `Canal: ${channel}. Tipo: ${warm ? "WARM/indicado (curto, por pergunta, diálogo)" : "COLD (frio, liderado por André Kachan, sem marca Salestrack, sem oferecer serviço, um único CTA)"}.`,
    opts?.modelo ? `Diretriz do passo da cadência: ${opts.modelo}` : "",
    channel === "email" ? "Gere ASSUNTO (curto, sem clickbait) e CORPO." : "Gere só o CORPO (mensagem curta).",
    !warm ? `CTA único: convite de baixa fricção para uma conversa, com este link de agenda: ${agenda}` : "",
    duracaoMin
      ? `A agenda desse link é de ${duracaoMin} MINUTOS. Se mencionar a duração, diga exatamente ${duracaoMin} minutos — NUNCA prometa um tempo diferente do que a agenda marca.`
      : "NÃO mencione duração da conversa: não sabemos quanto tempo a agenda reserva.",
    "IMPORTANTE: o conteúdo deve ser COERENTE com o que a Salestrack entrega (ver abaixo) — a dor escolhida e o ângulo devem levar naturalmente a essa solução, para que a conversa e os próximos toques conectem à oferta. No 1º toque frio NÃO descreva nem ofereça o serviço; apenas escolha uma dor que a nossa entrega resolve.",
    "Assine como André Kachan.",
  ].filter(Boolean).join("\n");
  const r = await runAgentCore({
    agentKey: "prospect_writer", guardrails: PROSPECT_GUARDRAILS, extraContext: `${ctx.text}\n\n=== O QUE A SALESTRACK ENTREGA (para ancorar relevância) ===\n${offer}\n\nINSTRUÇÕES DO TOQUE:\n${brief}`, contextLabel: "DADOS DO PROSPECT", maxTokens: 600,
    userMessages: [{ role: "user", content: "Escreva o toque agora. Se for e-mail, comece com 'Assunto: ...' na primeira linha e o corpo em seguida." }],
  });
  if (r.degraded) return { id: null, degraded: true };
  let subject: string | null = null, body = r.text;
  const mSub = r.text.match(/^\s*assunto:\s*(.+)$/im);
  if (mSub) { subject = mSub[1].trim(); body = r.text.replace(mSub[0], "").trim(); }
  /**
   * O modelo costuma rotular a segunda parte com "Corpo:" — o pedido menciona "o corpo em
   * seguida", e ele espelha o vocabulário. Sem esta limpeza o rótulo VAI no e-mail: o primeiro
   * rascunho que geramos começava literalmente com "Corpo:". Rótulo estrutural não é conteúdo.
   */
  body = body.replace(/^\s*(corpo|body|mensagem)\s*:\s*/i, "").trim();
  const sb = createServiceClient();

  /**
   * Aviso de transparência no PRIMEIRO contato — obrigação, não cortesia.
   *
   * A prospecção trata dado profissional que a pessoa nunca nos deu, sob legítimo interesse. Essa
   * base só se sustenta com três coisas: finalidade legítima, o teste de proporcionalidade escrito
   * (docs/LIA_PROSPECCAO.md) e transparência com via de oposição fácil (art. 9º e art. 18, §2º).
   * Esta é a terceira.
   *
   * É acrescentado por CÓDIGO, nunca pedido ao modelo: obrigação legal não pode depender de o
   * gerador ter lembrado. E só no primeiro toque — repetir em todos vira ruído.
   *
   * ── Por que o carimbo NÃO acontece aqui ─────────────────────────────────────────────────────
   * A versão anterior gravava `aviso_em` ao gerar o rascunho. Como todo rascunho passa por uma fila
   * de aprovação e pode ser reprovado, bastava descartar um para o prospect ficar marcado como
   * avisado sem nunca ter recebido nada — e o próximo toque, o de verdade, sairia SEM o aviso. Um
   * campo dizendo que a obrigação foi cumprida quando ela não foi é pior do que campo nenhum.
   *
   * Agora o carimbo é de `deliverApproved`, na hora em que a mensagem realmente sai. Enquanto não
   * sair, todo rascunho novo continua nascendo com o rodapé — repetição é o erro barato aqui.
   */
  const { data: pr } = await sb.from("prospects")
    .select("email, procedencia, aviso_em, source").eq("id", prospectId).maybeSingle();
  if (pr && deveEscreverRodape({ procedencia: pr.procedencia as string | null, email: pr.email as string | null, avisoEm: pr.aviso_em as string | null })) {
    const fonte = pr!.source === "apollo" ? "uma base profissional de terceiro" : "seu perfil profissional público";
    const saida = await linkDescadastro(pr!.email as string);
    const via = saida
      ? `responda esta mensagem com "sair" ou use este link: ${saida}`
      : `responda esta mensagem com "sair", ou escreva para ${EMAIL_ENCARREGADO}`;
    const rodape = channel === "email"
      ? `\n\n---\nChego até você por ${fonte}, usando dados profissionais (nome, cargo e empresa) — nunca dados pessoais. `
        + `A base legal é legítimo interesse em prospecção B2B. Se preferir não receber contato, ${via}. `
        + `Para ver ou apagar o que temos sobre você: ${urlDireitos()}. `
        + `Encarregado de dados: ${NOME_ENCARREGADO} · ${EMAIL_ENCARREGADO}.`
      : `\n\nCheguei por ${fonte}, com dados profissionais. Se preferir não receber contato, responda "sair".`;
    body = `${body}${rodape}`;
  }

  const { data } = await sb.from("outreach_messages").insert({ prospect_id: prospectId, channel, subject, body, variant: warm ? "warm" : "cold", agent_generated: true, status: "rascunho" }).select("id").single();
  await auditService("outreach.generate", "outreach_messages", data?.id, { channel, warm, tokens: r.tokens }, undefined);
  return { id: data?.id ?? null, degraded: false };
}

const CLASS_LABELS = ["positiva", "objecao", "nao", "fora_do_momento", "encaminhou"];
/** prospect_classifier — classifica a resposta recebida e sugere próximo passo. */
export async function classifyResponse(prospectId: string, responseText: string): Promise<{ label: string; suggestion: string; degraded: boolean }> {
  const ctx = await buildProspectContext(prospectId);
  const r = await runAgentCore({
    agentKey: "prospect_classifier", guardrails: PROSPECT_GUARDRAILS, extraContext: `${ctx?.text ?? ""}\n\nRESPOSTA RECEBIDA:\n${responseText}`, contextLabel: "CONTEXTO", maxTokens: 300,
    userMessages: [{ role: "user", content: `Classifique a resposta em UMA destas etiquetas: ${CLASS_LABELS.join(", ")}. Responda a primeira linha SÓ com a etiqueta, e a segunda linha com o próximo passo sugerido (1 frase).` }],
  });
  if (r.degraded) return { label: "objecao", suggestion: "Revisar manualmente.", degraded: true };
  const first = r.text.split(/\r?\n/)[0].toLowerCase().replace(/[^a-z_]/g, "");
  const label = CLASS_LABELS.find((l) => first.includes(l)) ?? "objecao";
  const suggestion = r.text.split(/\r?\n/).slice(1).join(" ").trim() || "—";
  return { label, suggestion, degraded: false };
}

/** Classificador de intenção GENÉRICO (reusa o agente/etiquetas da Fase 5.5) — sem contexto de prospect.
 * Usado pelo Relacionamento (WhatsApp/e-mail) no E4. Degrada sem ANTHROPIC. */
export async function classifyIntent(text: string, contexto?: string): Promise<{ label: string; suggestion: string; degraded: boolean }> {
  const r = await runAgentCore({
    agentKey: "prospect_classifier", guardrails: PROSPECT_GUARDRAILS, extraContext: `${contexto ?? ""}\n\nMENSAGEM RECEBIDA:\n${text}`, contextLabel: "CONTEXTO",
    maxTokens: 300,
    userMessages: [{ role: "user", content: `Classifique a intenção da mensagem em UMA destas etiquetas: ${CLASS_LABELS.join(", ")}. Primeira linha SÓ a etiqueta; segunda linha o próximo passo sugerido (1 frase).` }],
  });
  if (r.degraded) return { label: "objecao", suggestion: "Revisar manualmente.", degraded: true };
  const first = r.text.split(/\r?\n/)[0].toLowerCase().replace(/[^a-z_]/g, "");
  const label = CLASS_LABELS.find((l) => first.includes(l)) ?? "objecao";
  const suggestion = r.text.split(/\r?\n/).slice(1).join(" ").trim() || "—";
  return { label, suggestion, degraded: false };
}
