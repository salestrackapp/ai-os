"use server";
import { revalidatePath } from "next/cache";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/** Registro declarativo do stack de IA do cliente. NADA conecta — é documentação. */
export async function saveStackEntry(id: string | null, formData: FormData) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) throw new Error("Sem contexto.");
  const row = {
    org_id: m.orgId,
    platform_name: String(formData.get("platform_name") ?? "").trim(),
    purpose: String(formData.get("purpose") ?? "").trim() || null,
    data_classification: String(formData.get("data_classification") ?? "interno"),
    authorized_data: String(formData.get("authorized_data") ?? "").trim() || null,
    owner: String(formData.get("owner") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (!row.platform_name) throw new Error("Nome da plataforma é obrigatório.");
  const svc = createServiceClient();
  if (id) await svc.from("ai_stack_entries").update(row).eq("id", id).eq("org_id", m.orgId);
  else await svc.from("ai_stack_entries").insert(row);
  await auditService("ai_stack.save", "ai_stack_entries", id ?? undefined, { platform: row.platform_name }, m.orgId);
  revalidatePath("/portal/stack");
}

export async function deleteStackEntry(id: string) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) throw new Error("Sem contexto.");
  const svc = createServiceClient();
  await svc.from("ai_stack_entries").delete().eq("id", id).eq("org_id", m.orgId);
  await auditService("ai_stack.delete", "ai_stack_entries", id, null, m.orgId);
  revalidatePath("/portal/stack");
}
