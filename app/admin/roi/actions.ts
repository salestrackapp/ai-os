"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateRoiReport } from "@/lib/agents/roi";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Sem permissão.");
}
function periodoToDate(periodo?: string): Date {
  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) return new Date(`${periodo}-01T00:00:00Z`);
  const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
}

/** Gera o relatório de ROI de uma org para o mês. */
export async function generateRoiForOrg(orgId: string, periodo: string | undefined) {
  await requireAdmin();
  await generateRoiReport(orgId, periodoToDate(periodo));
  revalidatePath("/admin/roi");
}

/** Job: gera para todas as orgs com programa ativo. */
export async function generateRoiAllActive(periodo: string | undefined) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: projs } = await supabase.from("projects").select("org_id").eq("status", "ativo").not("org_id", "is", null);
  const orgIds = [...new Set((projs ?? []).map((p) => p.org_id))] as string[];
  const d = periodoToDate(periodo);
  for (const orgId of orgIds) { try { await generateRoiReport(orgId, d); } catch { /* segue os demais */ } }
  revalidatePath("/admin/roi");
}

export async function saveRoiNarrativa(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const narrativa = String(formData.get("narrativa") ?? "").trim();
  const { data: r } = await supabase.from("roi_reports").select("org_id").eq("id", id).single();
  const { error } = await supabase.from("roi_reports").update({ narrativa }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("roi.edit", "roi_reports", id, null, r?.org_id ?? undefined);
  revalidatePath("/admin/roi");
}

export async function publishRoi(id: string, next: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: r } = await supabase.from("roi_reports").select("org_id").eq("id", id).single();
  const { error } = await supabase.from("roi_reports").update({ publicado: next }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(next ? "roi.publish" : "roi.unpublish", "roi_reports", id, null, r?.org_id ?? undefined);
  revalidatePath("/admin/roi"); revalidatePath("/portal/roi");
}
