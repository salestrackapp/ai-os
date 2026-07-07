import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { getSetting } from "@/lib/settings/resolve";
import { googleConfigured, sendGmail } from "@/lib/google";
import { requireTeam } from "./inbox";
import { notify } from "./notify";
import { canTransition } from "./types";

export type SendPolicy = "aprovar_sempre" | "direto_autorizado";

/** Política de envio da caixa (default: aprovar sempre). IA rascunha → humano aprova → sistema envia. */
export async function getSendPolicy(): Promise<SendPolicy> {
  const v = await getSetting<string>("rel_send_policy");
  return v === "direto_autorizado" ? "direto_autorizado" : "aprovar_sempre";
}
async function getSignature(): Promise<string> {
  return (await getSetting<string>("rel_email_signature")) || "—\nEquipe Salestrack AI";
}

/** Heurística leve: assuntos sensíveis exigem aprovação mesmo no modo direto. */
export function pareceSensivel(texto: string): boolean {
  return /\b(pre[çc]o|valor|or[çc]amento|desconto|contrato|reembolso|cancel|jur[íi]dic|multa|rescis)/i.test(texto || "");
}

const withSignature = (corpo: string, sig: string) => `${corpo.trim()}\n\n${sig}`;
const reSubject = (s: string | null) => (s && /^re:/i.test(s)) ? s : `Re: ${s || "(sem assunto)"}`;

async function registrarSaida(sb: ReturnType<typeof createServiceClient>, conv: { id: string; client_id: string | null; assunto: string | null; channel: string }, corpo: string, opts: { status: string; externalRef?: string | null; sentBy: string }) {
  await sb.from("rel_mensagens").insert({
    conversa_id: conv.id, direction: "out", corpo,
    status_entrega: opts.status, external_ref: opts.externalRef ?? null, sent_by: opts.sentBy,
    created_at: new Date().toISOString(),
  });
}

/** Timeline do cliente quando o envio sai de fato (reflete na ficha 360). Dedup por msg. */
async function timelineEnvio(sb: ReturnType<typeof createServiceClient>, conv: { id: string; client_id: string | null; assunto: string | null }, gmailId: string | null) {
  if (!conv.client_id) return;
  const extRef = `rel:msg:${gmailId ?? conv.id}:${Date.now()}`;
  await sb.from("timeline_events").insert({
    subject_type: "org", subject_id: conv.client_id, source: "gmail", kind: "email",
    summary: `Resposta enviada: ${conv.assunto ?? "conversa"}`, external_ref: extRef, occurred_at: new Date().toISOString(),
  });
}

/**
 * Responde uma conversa respeitando o GATE de envio.
 * - direto_autorizado (e não sensível): envia já pelo Gmail da Salestrack, registra 'enviado' + timeline.
 * - aprovar_sempre / forçar rascunho / sensível / sem Gmail: grava 'rascunho' (fila de aprovação) e notifica a equipe.
 */
export async function responderConversa(conversaId: string, corpoRaw: string, opts?: { forcarRascunho?: boolean }): Promise<{ enviado: boolean; pendente: boolean; motivo?: string }> {
  const { userId, orgId } = await requireTeam();
  const corpo = (corpoRaw || "").trim();
  if (!corpo) throw new Error("Escreva uma resposta antes de enviar.");
  const sb = createServiceClient();

  const { data: conv } = await sb.from("rel_conversas").select("id, channel, external_ref, contato_email, assunto, client_id, status").eq("id", conversaId).maybeSingle();
  if (!conv) throw new Error("Conversa não encontrada.");
  if (conv.channel !== "email") throw new Error("Responder WhatsApp chega no E3. Por ora, só e-mail.");

  const sig = await getSignature();
  const body = withSignature(corpo, sig);
  const policy = await getSendPolicy();
  const gOn = await googleConfigured();
  const sensivel = pareceSensivel(corpo) || pareceSensivel(conv.assunto || "");
  const podeDireto = policy === "direto_autorizado" && !opts?.forcarRascunho && !sensivel && gOn && !!conv.contato_email;

  if (podeDireto) {
    const res = await sendGmail(conv.contato_email!, reSubject(conv.assunto), body, { threadId: conv.external_ref || undefined });
    await registrarSaida(sb, conv, body, { status: res.sent ? "enviado" : "falha", externalRef: res.id ?? null, sentBy: userId });
    if (res.sent) {
      const to = canTransition(conv.status, "respondida") ? "respondida" : conv.status;
      await sb.from("rel_conversas").update({ status: to, unread: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conv.id);
      await timelineEnvio(sb, conv, res.id ?? null);
      await auditService("rel.enviado", "rel_conversas", conv.id, { modo: "direto", gmailId: res.id }, orgId);
      return { enviado: true, pendente: false };
    }
    await auditService("rel.envio_falhou", "rel_conversas", conv.id, { modo: "direto" }, orgId);
    return { enviado: false, pendente: false, motivo: "Falha no envio pelo Gmail — a mensagem ficou como rascunho." };
  }

  // Gate: vai para a fila de aprovação (rascunho de saída) e notifica a equipe.
  await registrarSaida(sb, conv, body, { status: "rascunho", sentBy: userId });
  await notify({ orgId, userId: null, tipo: "aprovacao", conversaId: conv.id, titulo: "Uma resposta aguarda aprovação" });
  await auditService("rel.rascunho_saida", "rel_conversas", conv.id, { sensivel, policy }, orgId);
  return { enviado: false, pendente: true, motivo: sensivel ? "Assunto sensível — enviei para aprovação." : undefined };
}

/** Aprova e ENVIA um rascunho de saída pendente (fila de aprovação). */
export async function aprovarEnvio(msgId: string): Promise<{ enviado: boolean; motivo?: string }> {
  const { userId, orgId } = await requireTeam();
  const sb = createServiceClient();
  const { data: msg } = await sb.from("rel_mensagens").select("id, conversa_id, corpo, media, direction, status_entrega").eq("id", msgId).maybeSingle();
  if (!msg || msg.direction !== "out" || msg.status_entrega !== "rascunho") throw new Error("Rascunho de saída não encontrado.");
  const { data: conv } = await sb.from("rel_conversas").select("id, channel, external_ref, contato_email, assunto, client_id, status").eq("id", msg.conversa_id).maybeSingle();
  if (!conv) throw new Error("Conversa não encontrada.");
  // WhatsApp: envio pela Z-API com revalidação de consentimento + janela 24h/HSM.
  if (conv.channel === "whatsapp") {
    const { enviarRascunhoWA } = await import("./responder-wa");
    return enviarRascunhoWA({ id: msg.id, conversa_id: msg.conversa_id, corpo: msg.corpo, media: (msg.media as { hsm?: boolean } | null) });
  }
  if (!(await googleConfigured()) || !conv.contato_email) return { enviado: false, motivo: "Gmail não conectado — não é possível enviar agora." };

  const res = await sendGmail(conv.contato_email, reSubject(conv.assunto), msg.corpo, { threadId: conv.external_ref || undefined });
  await sb.from("rel_mensagens").update({ status_entrega: res.sent ? "enviado" : "falha", external_ref: res.id ?? null }).eq("id", msg.id);
  if (!res.sent) { await auditService("rel.envio_falhou", "rel_conversas", conv.id, { modo: "aprovacao" }, orgId); return { enviado: false, motivo: "Falha no envio pelo Gmail." }; }
  const to = canTransition(conv.status, "respondida") ? "respondida" : conv.status;
  await sb.from("rel_conversas").update({ status: to, unread: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conv.id);
  await timelineEnvio(sb, conv, res.id ?? null);
  await auditService("rel.enviado", "rel_conversas", conv.id, { modo: "aprovacao", aprovadoPor: userId, gmailId: res.id }, orgId);
  return { enviado: true };
}

/** Descarta um rascunho de saída pendente (não envia). */
export async function descartarRascunhoSaida(msgId: string): Promise<void> {
  const { orgId } = await requireTeam();
  const sb = createServiceClient();
  const { data: msg } = await sb.from("rel_mensagens").select("id, conversa_id, direction, status_entrega").eq("id", msgId).maybeSingle();
  if (!msg || msg.direction !== "out" || msg.status_entrega !== "rascunho") return;
  await sb.from("rel_mensagens").delete().eq("id", msg.id);
  await auditService("rel.rascunho_descartado", "rel_conversas", msg.conversa_id, {}, orgId);
}

// ---------- Templates ----------
export type RelTemplate = { id: string; nome: string; assunto: string | null; corpo: string; atalho: string | null };

export async function listTemplates(): Promise<RelTemplate[]> {
  await requireTeam();
  const { data } = await createServiceClient().from("rel_templates").select("id, nome, assunto, corpo, atalho").is("deleted_at", null).eq("ativo", true).order("nome");
  return (data ?? []) as RelTemplate[];
}

/** Substitui {{nome}}/{{assunto}} do template pelos dados da conversa. */
export function renderTemplate(corpo: string, vars: { nome?: string | null; assunto?: string | null }): string {
  return (corpo || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome || "")
    .replace(/\{\{\s*assunto\s*\}\}/gi, vars.assunto || "");
}

export async function criarTemplate(t: { nome: string; assunto?: string | null; corpo: string; atalho?: string | null }): Promise<void> {
  const { userId, orgId } = await requireTeam();
  await createServiceClient().from("rel_templates").insert({ org_id: orgId, nome: t.nome, assunto: t.assunto || null, corpo: t.corpo, atalho: t.atalho || null, created_by: userId });
  await auditService("rel.template_criado", "rel_templates", undefined, { nome: t.nome }, orgId);
}
export async function removerTemplate(id: string): Promise<void> {
  const { orgId } = await requireTeam();
  await createServiceClient().from("rel_templates").update({ deleted_at: new Date().toISOString(), ativo: false }).eq("id", id);
  await auditService("rel.template_removido", "rel_templates", id, {}, orgId);
}

// ---------- Regras (rotulam/roteiam — nunca enviam) ----------
export type RelRegra = { id: string; nome: string; match_campo: "remetente" | "assunto"; match_valor: string; acao_rotulo: string | null; acao_assign_to: string | null };

export async function listRegras(): Promise<RelRegra[]> {
  await requireTeam();
  const { data } = await createServiceClient().from("rel_regras").select("id, nome, match_campo, match_valor, acao_rotulo, acao_assign_to").is("deleted_at", null).order("created_at", { ascending: false });
  return (data ?? []) as RelRegra[];
}
export async function criarRegra(r: { nome: string; match_campo: "remetente" | "assunto"; match_valor: string; acao_rotulo?: string | null; acao_assign_to?: string | null }): Promise<void> {
  const { userId, orgId } = await requireTeam();
  await createServiceClient().from("rel_regras").insert({ org_id: orgId, nome: r.nome, match_campo: r.match_campo, match_valor: r.match_valor, acao_rotulo: r.acao_rotulo || null, acao_assign_to: r.acao_assign_to || null, created_by: userId });
  await auditService("rel.regra_criada", "rel_regras", undefined, { nome: r.nome }, orgId);
}
export async function removerRegra(id: string): Promise<void> {
  const { orgId } = await requireTeam();
  await createServiceClient().from("rel_regras").update({ deleted_at: new Date().toISOString(), ativo: false }).eq("id", id);
  await auditService("rel.regra_removida", "rel_regras", id, {}, orgId);
}

/** Retorna as ações (rótulo/atribuição) que uma conversa dispara — para o SYNC aplicar. Nunca envia. */
export async function avaliarRegras(conv: { contato_email: string | null; assunto: string | null }): Promise<{ rotulo?: string; assignTo?: string }[]> {
  const { data } = await createServiceClient().from("rel_regras").select("match_campo, match_valor, acao_rotulo, acao_assign_to").is("deleted_at", null).eq("ativo", true);
  const out: { rotulo?: string; assignTo?: string }[] = [];
  for (const r of (data ?? []) as RelRegra[]) {
    const alvo = (r.match_campo === "assunto" ? conv.assunto : conv.contato_email) || "";
    if (r.match_valor && alvo.toLowerCase().includes(r.match_valor.toLowerCase())) {
      out.push({ rotulo: r.acao_rotulo || undefined, assignTo: r.acao_assign_to || undefined });
    }
  }
  return out;
}
