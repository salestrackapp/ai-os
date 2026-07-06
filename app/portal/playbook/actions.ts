"use server";
import { revalidatePath } from "next/cache";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";

/** Marca uma receita como concluída para a org do usuário (idempotente). Bloqueado na visão admin. */
export async function markRecipeDone(recipeId: string, formData?: FormData) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) throw new Error("Sem contexto.");
  if (m.adminView) throw new Error("Ação indisponível na visão admin.");
  const feedback = formData ? String(formData.get("feedback") ?? "").trim() || null : null;
  const svc = createServiceClient();
  await svc.from("recipe_progress").upsert(
    { org_id: m.orgId, user_id: m.userId, recipe_id: recipeId, status: "concluida", feedback },
    { onConflict: "org_id,user_id,recipe_id,status" },
  );
  await svc.from("audit_logs").insert({ org_id: m.orgId, actor_id: m.userId, action: "recipe.done", resource: "playbook_recipes", resource_id: recipeId, payload: { feedback }, hash: "pending" });
  revalidatePath("/portal/playbook");
}

/** Desfaz a conclusão de uma receita. */
export async function unmarkRecipe(recipeId: string) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) throw new Error("Sem contexto.");
  if (m.adminView) throw new Error("Ação indisponível na visão admin.");
  const svc = createServiceClient();
  await svc.from("recipe_progress").delete().eq("org_id", m.orgId).eq("user_id", m.userId).eq("recipe_id", recipeId).eq("status", "concluida");
  revalidatePath("/portal/playbook");
}
