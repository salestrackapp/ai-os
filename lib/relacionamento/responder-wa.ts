import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { canalWhatsApp, zapiConfigured } from "@/lib/whatsapp";
import { requireTeam, listConversaByIdTeam } from "./inbox";
import { getSendPolicy, renderTemplate, pareceSensivel } from "./responder";
import { whatsappContext } from "./sync-whatsapp";
import { canSendWhatsApp, canTransition } from "./types";
import { notify } from "./notify";

type WaSendResult = { enviado: boolean; pendente: boolean; bloqueado?: boolean; motivo?: string };

async function registrarSaidaWA(sb: ReturnType<typeof createServiceClient>, convId: string, corpo: string, opts: { status: string; providerRef?: string | null; hsm: boolean; sentBy: string }) {
  await sb.from("rel_mensagens").insert({
    conversa_id: convId, direction: "out", corpo,
    media: { canal: "whatsapp", hsm: opts.hsm }, status_entrega: opts.status,
    provider_ref: opts.providerRef ?? null, sent_by: opts.sentBy, created_at: new Date().toISOString(),
  });
}

async function timelineEnvioWA(sb: ReturnType<typeof createServiceClient>, conv: { client_id: string | null; contato_nome: string | null; contato_phone: string | null }) {
  if (!conv.client_id) return;
  await sb.from("timeline_events").insert({
    subject_type: "org", subject_id: conv.client_id, source: "manual", kind: "resposta",
    summary: `WhatsApp enviado para ${conv.contato_nome ?? conv.contato_phone ?? "contato"}`,
    external_ref: `rel:wa:${conv.contato_phone}:${Date.now()}`, occurred_at: new Date().toISOString(),
  });
}

/** Resolve corpo final: template (variáveis no envio) OU texto livre. Retorna {body, hsm}. */
async function resolverCorpo(sb: ReturnType<typeof createServiceClient>, templateId: string | undefined, corpo: string | undefined, nome: string | null): Promise<{ body: string; hsm: boolean } | { erro: string }> {
  if (templateId) {
    const { data: t } = await sb.from("rel_templates").select("corpo, hsm, canal").eq("id", templateId).is("deleted_at", null).maybeSingle();
    if (!t) return { erro: "Template não encontrado." };
    if (t.canal === "email") return { erro: "Template não é do canal WhatsApp." };
    // PII só no envio: as variáveis são resolvidas agora, não gravadas antes.
    return { body: renderTemplate(t.corpo, { nome, assunto: null }), hsm: !!t.hsm };
  }
  const body = (corpo || "").trim();
  if (!body) return { erro: "Escreva uma mensagem ou escolha um template." };
  return { body, hsm: false };
}

/**
 * Responde/envia no WhatsApp respeitando CONSENTIMENTO + janela 24h/HSM e o GATE de envio.
 * Bloqueia (sem rascunho) quando a regra do canal não permite. Registra out + timeline. Graceful.
 */
export async function responderWhatsApp(conversaId: string, input: { corpo?: string; templateId?: string; forcarRascunho?: boolean }): Promise<WaSendResult> {
  const { userId, orgId } = await requireTeam();
  const sb = createServiceClient();
  const conv = await listConversaByIdTeam(conversaId);
  if (!conv) throw new Error("Conversa não encontrada.");
  if (conv.channel !== "whatsapp") throw new Error("Esta conversa não é de WhatsApp.");
  if (!conv.contato_phone) throw new Error("Conversa sem telefone do contato.");

  const resolved = await resolverCorpo(sb, input.templateId, input.corpo, conv.contato_nome);
  if ("erro" in resolved) throw new Error(resolved.erro);
  const { body, hsm } = resolved;

  const wa = await whatsappContext({ id: conv.id, contact_id: conv.contact_id, contato_phone: conv.contato_phone });
  const regra = canSendWhatsApp({ optIn: wa.optIn, windowOpen: wa.windowOpen, isHsm: hsm });
  if (!regra.ok) {
    await auditService("rel.wa_bloqueado", "rel_conversas", conv.id, { motivo: regra.motivo, hsm }, orgId);
    return { enviado: false, pendente: false, bloqueado: true, motivo: regra.motivo };
  }

  const policy = await getSendPolicy();
  const sensivel = pareceSensivel(body);
  const podeDireto = policy === "direto_autorizado" && !input.forcarRascunho && !sensivel && (await zapiConfigured());

  if (podeDireto) {
    const res = await canalWhatsApp().enviar(conv.contato_phone, body, { org_id: orgId, ref_table: "rel_conversas", ref_id: conv.id });
    await registrarSaidaWA(sb, conv.id, body, { status: res.ok ? "enviado" : "falha", providerRef: res.providerRef ?? null, hsm, sentBy: userId });
    if (res.ok) {
      const to = canTransition(conv.status, "respondida") ? "respondida" : conv.status;
      await sb.from("rel_conversas").update({ status: to, unread: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conv.id);
      await timelineEnvioWA(sb, conv);
      await auditService("rel.wa_enviado", "rel_conversas", conv.id, { modo: "direto", hsm, ref: res.providerRef }, orgId);
      return { enviado: true, pendente: false };
    }
    await auditService("rel.wa_falhou", "rel_conversas", conv.id, { modo: "direto" }, orgId);
    return { enviado: false, pendente: false, motivo: "Falha no envio pela Z-API — mensagem registrada como falha." };
  }

  // gate: fila de aprovação (rascunho de saída carrega o flag hsm p/ revalidar no aprovar)
  await sb.from("rel_mensagens").insert({
    conversa_id: conv.id, direction: "out", corpo: body, media: { canal: "whatsapp", hsm },
    status_entrega: "rascunho", sent_by: userId, created_at: new Date().toISOString(),
  });
  await notify({ orgId, userId: null, tipo: "aprovacao", conversaId: conv.id, titulo: "Uma mensagem de WhatsApp aguarda aprovação" });
  await auditService("rel.wa_rascunho", "rel_conversas", conv.id, { hsm, sensivel, policy }, orgId);
  return { enviado: false, pendente: true, motivo: sensivel ? "Assunto sensível — enviei para aprovação." : undefined };
}

/** Envia um rascunho de saída de WhatsApp já aprovado (revalida consentimento + janela/HSM). */
export async function enviarRascunhoWA(msg: { id: string; conversa_id: string; corpo: string; media: { hsm?: boolean } | null }): Promise<{ enviado: boolean; motivo?: string }> {
  const { userId, orgId } = await requireTeam();
  const sb = createServiceClient();
  const conv = await listConversaByIdTeam(msg.conversa_id);
  if (!conv || !conv.contato_phone) return { enviado: false, motivo: "Conversa sem telefone." };
  if (!(await zapiConfigured())) return { enviado: false, motivo: "Z-API não conectada — não é possível enviar agora." };

  const hsm = !!msg.media?.hsm;
  const wa = await whatsappContext({ id: conv.id, contact_id: conv.contact_id, contato_phone: conv.contato_phone });
  const regra = canSendWhatsApp({ optIn: wa.optIn, windowOpen: wa.windowOpen, isHsm: hsm });
  if (!regra.ok) return { enviado: false, motivo: regra.motivo };

  const res = await canalWhatsApp().enviar(conv.contato_phone, msg.corpo, { org_id: orgId, ref_table: "rel_conversas", ref_id: conv.id });
  await sb.from("rel_mensagens").update({ status_entrega: res.ok ? "enviado" : "falha", provider_ref: res.providerRef ?? null }).eq("id", msg.id);
  if (!res.ok) return { enviado: false, motivo: "Falha no envio pela Z-API." };
  const to = canTransition(conv.status, "respondida") ? "respondida" : conv.status;
  await sb.from("rel_conversas").update({ status: to, unread: false, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conv.id);
  await timelineEnvioWA(sb, conv);
  await auditService("rel.wa_enviado", "rel_conversas", conv.id, { modo: "aprovacao", aprovadoPor: userId, hsm }, orgId);
  return { enviado: true };
}

/** Templates do canal WhatsApp (HSM + respostas rápidas). */
export async function listTemplatesWhatsApp(): Promise<{ id: string; nome: string; corpo: string; atalho: string | null; hsm: boolean }[]> {
  await requireTeam();
  const { data } = await createServiceClient().from("rel_templates").select("id, nome, corpo, atalho, hsm").is("deleted_at", null).eq("ativo", true).in("canal", ["whatsapp", "ambos"]).order("hsm", { ascending: false }).order("nome");
  return (data ?? []) as { id: string; nome: string; corpo: string; atalho: string | null; hsm: boolean }[];
}
