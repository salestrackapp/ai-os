"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { audit } from "@/lib/audit";

/** Admin entra no portal no contexto da org (visão total). */
export async function viewPortalAs(orgId: string) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  (await cookies()).set("aios_view_org", orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 4 });
  redirect("/portal");
}

/** Sai da visão de portal e volta ao admin. */
export async function exitPortalView() {
  (await cookies()).delete("aios_view_org");
  redirect("/admin/programas");
}

export async function setProgramStatus(projectId: string, status: string) {
  if (!["onboarding", "ativo", "pausado", "encerrado"].includes(status)) throw new Error("Status inválido.");
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "ativo") { patch.activated_at = new Date().toISOString(); patch.activated_by = "admin"; }
  const { data: proj } = await supabase.from("projects").select("org_id").eq("id", projectId).single();
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) throw new Error(error.message);
  await audit("program.status", "projects", projectId, { status, by: "admin" }, proj?.org_id ?? undefined);
  revalidatePath(`/admin/programas/${projectId}`);
  revalidatePath("/admin/programas");
}

export async function uploadLibraryAsset(orgId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "documento");
  const tags = String(formData.get("tags") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const file = formData.get("file") as File | null;
  if (!title || !file || file.size === 0) throw new Error("Título e arquivo são obrigatórios.");

  const svc = createServiceClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${orgId}/${Date.now()}-${safe}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await svc.storage.from("biblioteca").upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) throw new Error(up.error.message);

  const { data, error } = await supabase.from("library_assets").insert({ org_id: orgId, type, title, storage_path: path, meta: { tags } }).select("id").single();
  if (error) throw new Error(error.message);
  await audit("library.upload", "library_assets", data.id, { title, type, orgId }, orgId);
  revalidatePath(`/admin/programas`);
}

/** Concede/ajusta créditos de sessão (upsert por org+tipo). */
export async function grantSessionCredits(orgId: string, formData: FormData) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  const type = String(formData.get("type") ?? "");
  const total = Number(String(formData.get("total") ?? "0"));
  const validRaw = String(formData.get("valid_until") ?? "").trim();
  if (!type || !Number.isFinite(total) || total < 0) throw new Error("Tipo e quantidade válidos são obrigatórios.");
  const svc = createServiceClient();
  const { data: existing } = await svc.from("session_credits").select("id").eq("org_id", orgId).eq("type", type).maybeSingle();
  const row = { org_id: orgId, type, total, valid_until: validRaw ? new Date(validRaw).toISOString() : null };
  if (existing) await svc.from("session_credits").update(row).eq("id", existing.id);
  else await svc.from("session_credits").insert({ ...row, consumed: 0 });
  await audit("credits.grant", "session_credits", undefined, { type, total }, orgId);
  revalidatePath(`/admin/programas/${(await svc.from("projects").select("id").eq("org_id", orgId).limit(1).maybeSingle()).data?.id ?? ""}`);
  revalidatePath("/admin/programas");
}

/** Agenda uma sessão ao vivo (modo manual — sem Calendly). */
export async function scheduleSession(orgId: string, formData: FormData) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  const svc = createServiceClient();
  const catalogId = String(formData.get("catalog_id") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const when = String(formData.get("scheduled_at") ?? "").trim();
  const meet = String(formData.get("meet_link") ?? "").trim() || null;
  if (!type || !title) throw new Error("Tipo e título são obrigatórios.");
  const { error } = await svc.from("sessions").insert({
    org_id: orgId, type, title, meet_link: meet, catalog_id: catalogId || null,
    scheduled_at: when ? new Date(when).toISOString() : null, status: "agendada",
  });
  if (error) throw new Error(error.message);
  await audit("session.schedule", "sessions", undefined, { type, title }, orgId);
  revalidatePath("/admin/programas");
}

/** Fecha uma sessão manualmente (fallback do Read AI): status realizada + resumo/gravação, debita 1 crédito. */
export async function closeSession(sessionId: string, formData: FormData) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  const svc = createServiceClient();
  const { data: s } = await svc.from("sessions").select("org_id, type, status").eq("id", sessionId).single();
  if (!s) throw new Error("Sessão não encontrada.");
  const summary = String(formData.get("summary_md") ?? "").trim() || null;
  const recording = String(formData.get("recording_url") ?? "").trim() || null;
  await svc.from("sessions").update({ status: "realizada", summary_md: summary, recording_url: recording }).eq("id", sessionId);
  // debita 1 crédito do tipo, se ainda não debitado (idempotência simples por transição de status)
  if (s.status !== "realizada") {
    const { data: cr } = await svc.from("session_credits").select("id, total, consumed").eq("org_id", s.org_id).eq("type", s.type).maybeSingle();
    if (cr && (cr.consumed ?? 0) < cr.total) await svc.from("session_credits").update({ consumed: (cr.consumed ?? 0) + 1 }).eq("id", cr.id);
  }
  await audit("session.close", "sessions", sessionId, null, s.org_id);
  revalidatePath("/admin/programas");
}

export async function deleteLibraryAsset(id: string) {
  const supabase = await createClient();
  const { data: a } = await supabase.from("library_assets").select("storage_path, org_id").eq("id", id).single();
  if (a?.storage_path) await createServiceClient().storage.from("biblioteca").remove([a.storage_path]);
  const { error } = await supabase.from("library_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("library.delete", "library_assets", id, null, a?.org_id ?? undefined);
  revalidatePath("/admin/programas");
}
