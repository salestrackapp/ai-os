"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { syncGmailInbox } from "@/lib/relacionamento/sync-email";
import { assignConversa, setConversaStatus, snoozeConversa, setUnread, linkConversaCliente } from "@/lib/relacionamento/inbox";
import { responderConversa, aprovarEnvio, descartarRascunhoSaida } from "@/lib/relacionamento/responder";
import { responderWhatsApp } from "@/lib/relacionamento/responder-wa";
import type { ConvStatus } from "@/lib/relacionamento/types";

export async function syncInboxAction() {
  await syncGmailInbox();
  revalidatePath("/admin/relacionamento");
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
