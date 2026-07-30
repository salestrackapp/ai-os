"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { currentMembership } from "@/lib/auth";
import { configurarWebhookRecebido } from "@/lib/whatsapp";
import { syncGmailInbox } from "@/lib/relacionamento/sync-email";
import { assignConversa, setConversaStatus, snoozeConversa, setUnread, linkConversaCliente } from "@/lib/relacionamento/inbox";
import { responderConversa, aprovarEnvio, descartarRascunhoSaida } from "@/lib/relacionamento/responder";
import { responderWhatsApp } from "@/lib/relacionamento/responder-wa";
import type { ConvStatus } from "@/lib/relacionamento/types";

export async function syncInboxAction() {
  await syncGmailInbox();
  revalidatePath("/admin/relacionamento");
}

/** Reconcilia o WhatsApp recebido (wa_messages → inbox de equipe) — auto-cura conteúdo perdido. */
export async function reconcileWhatsAppAction() {
  const { reconcileWhatsAppInbound } = await import("@/lib/relacionamento/sync-whatsapp");
  await reconcileWhatsAppInbound();
  revalidatePath("/admin/relacionamento");
}

/** Registra automaticamente o webhook de recebimento do WhatsApp na Z-API (torna o WA real-time). */
export async function ativarRecebimentoWhatsAppAction(): Promise<{ ok: boolean; url?: string; erro?: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return { ok: false, erro: "Apenas a equipe Salestrack." };
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return { ok: false, erro: "Não consegui detectar a URL do app." };
  const key = process.env.WHATSAPP_WEBHOOK_KEY;
  const url = `${proto}://${host}/api/whatsapp/webhook${key ? `?key=${encodeURIComponent(key)}` : ""}`;
  const r = await configurarWebhookRecebido(url);
  revalidatePath("/admin/relacionamento");
  return { ok: r.ok, url: r.url, erro: r.erro };
}

export async function markReadAction(id: string, unread: boolean) {
  await setUnread(id, unread);
  revalidatePath("/admin/relacionamento");
  revalidatePath(`/admin/relacionamento/${id}`);
}

export async function assignToMeAction(id: string) {
  const m = await currentMembership();
  await assignConversa(id, m?.userId ?? null);
  revalidatePath(`/admin/relacionamento/${id}`);
  revalidatePath("/admin/relacionamento");
}

export async function unassignAction(id: string) {
  await assignConversa(id, null);
  revalidatePath(`/admin/relacionamento/${id}`);
  revalidatePath("/admin/relacionamento");
}

export async function statusAction(id: string, to: ConvStatus) {
  await setConversaStatus(id, to);
  revalidatePath(`/admin/relacionamento/${id}`);
  revalidatePath("/admin/relacionamento");
}

export async function snoozeAction(id: string, dias: number) {
  const until = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null;
  await snoozeConversa(id, until);
  revalidatePath(`/admin/relacionamento/${id}`);
}

/** Vincula a thread a um cliente (org) — grava evento na timeline e reflete na ficha 360. */
export async function linkClienteAction(id: string, formData: FormData) {
  const client_id = String(formData.get("client_id") ?? "").trim() || null;
  await linkConversaCliente(id, { client_id });
  revalidatePath(`/admin/relacionamento/${id}`);
  if (client_id) revalidatePath(`/admin/clientes/${client_id}`);
}

/** Responder pela caixa — respeita o gate de envio (envia direto ou vai à fila de aprovação). */
export async function responderAction(id: string, formData: FormData): Promise<{ ok: boolean; enviado: boolean; pendente: boolean; erro?: string }> {
  const corpo = String(formData.get("corpo") ?? "");
  const forcarRascunho = String(formData.get("modo") ?? "") === "rascunho";
  try {
    const r = await responderConversa(id, corpo, { forcarRascunho });
    revalidatePath(`/admin/relacionamento/${id}`);
    revalidatePath("/admin/relacionamento");
    return { ok: true, enviado: r.enviado, pendente: r.pendente, erro: r.motivo };
  } catch (e) {
    return { ok: false, enviado: false, pendente: false, erro: e instanceof Error ? e.message : "Erro ao responder." };
  }
}

/** Responder/enviar pelo WhatsApp — aplica consentimento + janela 24h/HSM + gate. */
export async function responderWhatsAppAction(id: string, formData: FormData): Promise<{ ok: boolean; enviado: boolean; pendente: boolean; bloqueado?: boolean; erro?: string }> {
  const corpo = String(formData.get("corpo") ?? "");
  const templateId = String(formData.get("templateId") ?? "").trim() || undefined;
  const forcarRascunho = String(formData.get("modo") ?? "") === "rascunho";
  try {
    const r = await responderWhatsApp(id, { corpo: corpo || undefined, templateId, forcarRascunho });
    revalidatePath(`/admin/relacionamento/${id}`);
    revalidatePath("/admin/relacionamento");
    return { ok: !r.bloqueado, enviado: r.enviado, pendente: r.pendente, bloqueado: r.bloqueado, erro: r.motivo };
  } catch (e) {
    return { ok: false, enviado: false, pendente: false, erro: e instanceof Error ? e.message : "Erro ao enviar." };
  }
}

/**
 * Envia (ou descarta) o rascunho que o agente escreveu.
 *
 * O envio passa pelo MESMO caminho de qualquer resposta humana — inclusive o gate de aprovação. O
 * agente não ganha uma porta própria para o canal: o que ele fez foi poupar a digitação, não pular
 * a fila. Se o texto saiu diferente do sugerido, guardamos as duas versões; é assim que se descobre
 * se o agente ajuda ou dá trabalho.
 */
export async function decidirSugestaoAction(
  sugestaoId: string, conversaId: string, texto: string, descartar = false,
): Promise<{ ok: boolean; enviado?: boolean; pendente?: boolean; erro?: string }> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return { ok: false, erro: "Apenas a equipe Salestrack." };

  const { createServiceClient } = await import("@/lib/supabase/service");
  const { decidirSugestao, classificarDecisao } = await import("@/lib/relacionamento/sugestao");
  const sb = createServiceClient();
  const { data: s } = await sb.from("rel_sugestoes").select("texto, status, conversa_id").eq("id", sugestaoId).maybeSingle();
  if (!s || s.conversa_id !== conversaId) return { ok: false, erro: "Sugestão não encontrada." };
  if (s.status !== "pendente") return { ok: false, erro: "Esta sugestão já foi decidida." };

  if (descartar) {
    await decidirSugestao(sugestaoId, "descartada", null, m.userId);
    revalidatePath(`/admin/relacionamento/${conversaId}`);
    return { ok: true };
  }

  const corpo = texto.trim();
  if (!corpo) return { ok: false, erro: "A mensagem está vazia." };

  const { data: conv } = await sb.from("rel_conversas").select("channel").eq("id", conversaId).maybeSingle();
  try {
    const r = conv?.channel === "email"
      ? await responderConversa(conversaId, corpo, {})
      : await responderWhatsApp(conversaId, { corpo });
    if ("bloqueado" in r && r.bloqueado) return { ok: false, erro: r.motivo ?? "Envio bloqueado pelas regras do canal." };

    const desfecho = classificarDecisao(String(s.texto ?? ""), corpo);
    await decidirSugestao(sugestaoId, desfecho, desfecho === "editada" ? corpo : null, m.userId);
    revalidatePath(`/admin/relacionamento/${conversaId}`);
    revalidatePath("/admin/relacionamento");
    return { ok: true, enviado: r.enviado, pendente: r.pendente };
  } catch (e) {
    // A sugestão continua pendente: falha de envio não pode consumir o rascunho.
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao enviar." };
  }
}

/** Aprova e envia um rascunho de saída pendente (fila de aprovação). */
export async function aprovarEnvioAction(msgId: string, conversaId: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const r = await aprovarEnvio(msgId);
    revalidatePath(`/admin/relacionamento/${conversaId}`);
    revalidatePath("/admin/relacionamento");
    return { ok: r.enviado, erro: r.motivo };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao aprovar." };
  }
}

/** Versão void (para <form action>) — aprova e envia o rascunho pendente. */
export async function aprovarEnvioFormAction(msgId: string, conversaId: string) {
  await aprovarEnvioAction(msgId, conversaId);
}

/** Descarta um rascunho de saída pendente. */
export async function descartarEnvioAction(msgId: string, conversaId: string) {
  await descartarRascunhoSaida(msgId);
  revalidatePath(`/admin/relacionamento/${conversaId}`);
}

/** Ações em massa na lista: assumir p/ mim, mudar status, snooze. */
export async function bulkAction(formData: FormData) {
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const op = String(formData.get("op") ?? "");
  if (!ids.length || !op) return;
  const m = await currentMembership();
  for (const id of ids) {
    if (op === "assumir") await assignConversa(id, m?.userId ?? null);
    else if (op === "soltar") await assignConversa(id, null);
    else if (op.startsWith("status:")) { try { await setConversaStatus(id, op.slice(7) as ConvStatus); } catch { /* transição inválida: ignora item */ } }
    else if (op.startsWith("snooze:")) await snoozeConversa(id, new Date(Date.now() + Number(op.slice(7)) * 86400000).toISOString());
  }
  revalidatePath("/admin/relacionamento");
}
