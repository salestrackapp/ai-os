"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { syncGmailInbox } from "@/lib/relacionamento/sync-email";
import { assignConversa, setConversaStatus, snoozeConversa, setUnread, linkConversaCliente } from "@/lib/relacionamento/inbox";
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
