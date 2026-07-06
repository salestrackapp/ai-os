"use server";
import { revalidatePath } from "next/cache";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/** Marca um item do checklist de ativação como concluído. Ao completar todos, grava completed_at. */
export async function markChecklistItem(key: string) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) throw new Error("Sem contexto.");
  const svc = createServiceClient();
  const { data: c } = await svc.from("onboarding_checklists").select("items, completed_at").eq("org_id", m.orgId).maybeSingle();
  if (!c) return;
  const items = (Array.isArray(c.items) ? c.items : []).map((it: { key: string; done: boolean }) => it.key === key ? { ...it, done: true, done_at: new Date().toISOString() } : it);
  const allDone = items.every((it: { done: boolean }) => it.done);
  await svc.from("onboarding_checklists").update({ items, completed_at: allDone ? (c.completed_at ?? new Date().toISOString()) : null }).eq("org_id", m.orgId);
  await auditService("onboarding.check", "onboarding_checklists", key, { allDone }, m.orgId);
  revalidatePath("/portal");
}
