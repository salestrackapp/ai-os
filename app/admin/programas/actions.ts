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

export async function deleteLibraryAsset(id: string) {
  const supabase = await createClient();
  const { data: a } = await supabase.from("library_assets").select("storage_path, org_id").eq("id", id).single();
  if (a?.storage_path) await createServiceClient().storage.from("biblioteca").remove([a.storage_path]);
  const { error } = await supabase.from("library_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("library.delete", "library_assets", id, null, a?.org_id ?? undefined);
  revalidatePath("/admin/programas");
}
