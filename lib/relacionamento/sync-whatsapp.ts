import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { waWindowClosesAt, isWaWindowOpen } from "./types";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export type WaInbound = {
  phone: string;
  name?: string | null;
  text?: string | null;
  providerRef?: string | null;      // id da mensagem no provedor (idempotência)
  media?: { tipo: string; url?: string | null } | null;
  at?: string | null;               // ISO do provedor (fallback: agora)
};

/** Org da Salestrack (dona da inbox de equipe). Resolve por is_salestrack. */
async function salestrackOrgId(sb: ReturnType<typeof createServiceClient>): Promise<string | null> {
  const { data } = await sb.from("organizations").select("id").eq("is_salestrack", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

/**
 * Ingesta uma mensagem de WhatsApp recebida no modelo do E0 (inbox de equipe).
 * conversa channel=whatsapp, external_ref=telefone; mensagem in dedup por providerRef.
 * Auto-vincula contato/cliente pelo telefone (etiqueta CRM). Idempotente. Graceful. Server-only.
 */
export async function ingestWhatsAppInbound(msg: WaInbound): Promise<{ conversaId: string | null; nova: boolean }> {
  const sb = createServiceClient();
  const orgId = await salestrackOrgId(sb);
  if (!orgId) return { conversaId: null, nova: false };

  const phone = onlyDigits(msg.phone);
  if (!phone) return { conversaId: null, nova: false };
  const at = msg.at ?? new Date().toISOString();
  const corpo = msg.text || (msg.media ? `[${msg.media.tipo}]` : "(mensagem)");

  // auto-vínculo por telefone (últimos 8 dígitos) → contato + org do cliente
  let contactId: string | null = null, clientId: string | null = null, contatoNome = msg.name || null;
  if (phone.length >= 8) {
    const { data: c } = await sb.from("contacts").select("id, org_id, name, phone").ilike("phone", `%${phone.slice(-8)}%`).limit(1).maybeSingle();
    if (c) { contactId = c.id; clientId = c.org_id ?? null; contatoNome = contatoNome || c.name || null; }
  }

  // upsert da conversa (por channel+external_ref)
  let { data: conv } = await sb.from("rel_conversas").select("id, contact_id, client_id").eq("channel", "whatsapp").eq("external_ref", phone).is("deleted_at", null).maybeSingle();
  let conversaId = conv?.id as string | undefined;
  let nova = false;
  if (!conversaId) {
    const { data: ins } = await sb.from("rel_conversas").insert({
      org_id: orgId, channel: "whatsapp", external_ref: phone,
      assunto: contatoNome ? `WhatsApp · ${contatoNome}` : `WhatsApp · ${phone}`,
      contato_nome: contatoNome, contato_phone: phone,
      contact_id: contactId, client_id: clientId,
      status: "aberta", unread: true, last_message_at: at,
    }).select("id").single();
    conversaId = ins?.id; nova = !!conversaId;
  } else {
    await sb.from("rel_conversas").update({
      contato_nome: contatoNome ?? undefined, contato_phone: phone,
      contact_id: conv?.contact_id ?? contactId, client_id: conv?.client_id ?? clientId,
      unread: true, last_message_at: at, updated_at: new Date().toISOString(),
    }).eq("id", conversaId);
  }
  if (!conversaId) return { conversaId: null, nova: false };

  // idempotência da mensagem por providerRef
  if (msg.providerRef) {
    const { data: exists } = await sb.from("rel_mensagens").select("id").eq("external_ref", msg.providerRef).maybeSingle();
    if (exists) return { conversaId, nova: false };
  }
  await sb.from("rel_mensagens").insert({
    conversa_id: conversaId, direction: "in", corpo,
    media: msg.media ?? null, status_entrega: "recebido",
    external_ref: msg.providerRef ?? null, provider_ref: msg.providerRef ?? null, created_at: at,
  });
  await auditService("rel.wa_inbound", "rel_conversas", conversaId, { phone, nova }, orgId);
  return { conversaId, nova };
}

/** Estado do consentimento + janela de 24h de uma conversa de WhatsApp (informativo no E3; regra de envio é E4). */
export async function whatsappContext(conversa: { id: string; contact_id: string | null; contato_phone: string | null }): Promise<{ optIn: boolean; lastInboundAt: string | null; windowOpen: boolean; windowClosesAt: string | null }> {
  const sb = createServiceClient();
  let optIn = false;
  if (conversa.contact_id) {
    const { data } = await sb.from("contacts").select("opt_in_whatsapp").eq("id", conversa.contact_id).maybeSingle();
    optIn = !!data?.opt_in_whatsapp;
  } else if (conversa.contato_phone) {
    const d = onlyDigits(conversa.contato_phone);
    if (d.length >= 8) { const { data } = await sb.from("contacts").select("opt_in_whatsapp").ilike("phone", `%${d.slice(-8)}%`).limit(1).maybeSingle(); optIn = !!data?.opt_in_whatsapp; }
  }
  // última mensagem inbound define a janela de 24h
  const { data: lastIn } = await sb.from("rel_mensagens").select("created_at").eq("conversa_id", conversa.id).eq("direction", "in").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const lastInboundAt = lastIn?.created_at ?? null;
  const windowClosesAt = waWindowClosesAt(lastInboundAt);
  const windowOpen = isWaWindowOpen(lastInboundAt, new Date().toISOString());
  return { optIn, lastInboundAt, windowOpen, windowClosesAt };
}
