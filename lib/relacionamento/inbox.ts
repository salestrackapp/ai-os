import "server-only";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { notify } from "./notify";
import { canTransition, type Channel, type ConvStatus, type InboxFilter } from "./types";

/** Exige um membro da EQUIPE Salestrack. Base das permissões de leitura/resposta/atribuição. */
export async function requireTeam(): Promise<{ userId: string; orgId: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin || !m.userId || !m.orgId) throw new Error("Apenas a equipe Salestrack.");
  return { userId: m.userId, orgId: m.orgId };
}

/** Lista conversas da inbox compartilhada com filtro (minhas / não atribuídas / todas). */
export async function listConversas(opts: { channel?: Channel; filter?: InboxFilter; status?: ConvStatus; limit?: number } = {}) {
  const { userId } = await requireTeam();
  const sb = createServiceClient();
  let q = sb.from("rel_conversas").select("*").is("deleted_at", null).order("last_message_at", { ascending: false, nullsFirst: false }).limit(opts.limit ?? 100);
  if (opts.channel) q = q.eq("channel", opts.channel);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.filter === "minhas") q = q.eq("assigned_to", userId);
  else if (opts.filter === "nao_atribuidas") q = q.is("assigned_to", null);
  const { data } = await q;
  return data ?? [];
}

/** Carrega uma conversa por id (gate de equipe). Campos comuns para leitura/envio. */
export async function listConversaByIdTeam(conversaId: string): Promise<{ id: string; channel: Channel; external_ref: string | null; status: ConvStatus; contato_nome: string | null; contato_phone: string | null; contact_id: string | null; client_id: string | null; org_id: string } | null> {
  await requireTeam();
  const { data } = await createServiceClient().from("rel_conversas")
    .select("id, channel, external_ref, status, contato_nome, contato_phone, contact_id, client_id, org_id")
    .eq("id", conversaId).is("deleted_at", null).maybeSingle();
  return (data as { id: string; channel: Channel; external_ref: string | null; status: ConvStatus; contato_nome: string | null; contato_phone: string | null; contact_id: string | null; client_id: string | null; org_id: string } | null) ?? null;
}

/** Atribui (ou desatribui) uma conversa a um membro. Notifica o novo responsável. */
export async function assignConversa(conversaId: string, toUserId: string | null) {
  const { orgId } = await requireTeam();
  const sb = createServiceClient();
  await sb.from("rel_conversas").update({ assigned_to: toUserId, updated_at: new Date().toISOString() }).eq("id", conversaId);
  await auditService("rel.assign", "rel_conversas", conversaId, { to: toUserId }, orgId);
  if (toUserId) await notify({ orgId, userId: toUserId, tipo: "atribuicao", conversaId, titulo: "Uma conversa foi atribuída a você" });
}

/** Muda o status respeitando as transições permitidas (arquivada é terminal). */
export async function setConversaStatus(conversaId: string, to: ConvStatus) {
  const { orgId } = await requireTeam();
  const sb = createServiceClient();
  const { data: cur } = await sb.from("rel_conversas").select("status").eq("id", conversaId).maybeSingle();
  if (cur && !canTransition(cur.status as ConvStatus, to)) throw new Error(`Transição ${cur.status}→${to} não permitida.`);
  await sb.from("rel_conversas").update({ status: to, updated_at: new Date().toISOString() }).eq("id", conversaId);
  await auditService("rel.status", "rel_conversas", conversaId, { to }, orgId);
}

/** Adormece (snooze) a conversa até uma data — base do follow-up vencido. */
export async function snoozeConversa(conversaId: string, untilISO: string | null) {
  const { orgId } = await requireTeam();
  await createServiceClient().from("rel_conversas").update({ snooze_until: untilISO, updated_at: new Date().toISOString() }).eq("id", conversaId);
  await auditService("rel.snooze", "rel_conversas", conversaId, { until: untilISO }, orgId);
}

/** Marca lida/não lida. */
export async function setUnread(conversaId: string, unread: boolean) {
  await requireTeam();
  await createServiceClient().from("rel_conversas").update({ unread, updated_at: new Date().toISOString() }).eq("id", conversaId);
}

/** Vincula a conversa a um cliente/deal/contato (etiqueta CRM — não é acesso ao sistema do cliente).
 * Ao vincular a um cliente, registra evento na timeline (R2.5) → reflete na ficha 360. */
export async function linkConversaCliente(conversaId: string, link: { client_id?: string | null; deal_id?: string | null; contact_id?: string | null }) {
  const { orgId } = await requireTeam();
  const sb = createServiceClient();
  await sb.from("rel_conversas").update({ ...link, updated_at: new Date().toISOString() }).eq("id", conversaId);
  await auditService("rel.link_cliente", "rel_conversas", conversaId, link, orgId);

  if (link.client_id) {
    const { data: conv } = await sb.from("rel_conversas").select("channel, assunto, contato_email, external_ref").eq("id", conversaId).maybeSingle();
    const kind = conv?.channel === "whatsapp" ? "resposta" : "email";
    const src = conv?.channel === "whatsapp" ? "manual" : "gmail";
    // dedup: não repete o mesmo vínculo (conversa) na timeline do cliente
    const extRef = `rel:${conversaId}`;
    const { data: dup } = await sb.from("timeline_events").select("id").eq("subject_id", link.client_id).eq("external_ref", extRef).maybeSingle();
    if (!dup) {
      await sb.from("timeline_events").insert({
        subject_type: "org", subject_id: link.client_id, source: src, kind,
        summary: `Conversa vinculada (${conv?.channel === "whatsapp" ? "WhatsApp" : "e-mail"}): ${conv?.assunto ?? conv?.contato_email ?? "conversa"}`,
        external_ref: extRef, occurred_at: new Date().toISOString(),
      });
    }
  }
}

/** Salva o rascunho do MEMBRO atual para uma conversa (um por membro/conversa). */
export async function salvarRascunho(conversaId: string, corpo: string) {
  const { userId } = await requireTeam();
  const sb = createServiceClient();
  await sb.from("rel_rascunhos").upsert(
    { conversa_id: conversaId, user_id: userId, corpo, updated_at: new Date().toISOString() },
    { onConflict: "conversa_id,user_id" },
  );
}
