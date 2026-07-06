"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { isV2Accent } from "@/lib/deliverables/types";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

/** Cria/atualiza o rascunho de identidade de um programa (accent restrito ao v2). */
export async function saveIdentityAction(formData: FormData) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const programId = String(formData.get("program_id") ?? "");
  if (!programId) throw new Error("Programa obrigatório.");
  const { data: proj } = await sb.from("projects").select("org_id").eq("id", programId).single();
  if (!proj) throw new Error("Programa não encontrado.");

  const accentRaw = String(formData.get("accent") ?? "").trim();
  const accent = accentRaw && isV2Accent(accentRaw) ? accentRaw : null; // fora da paleta v2 → ignora
  const patch = {
    org_id: proj.org_id, program_id: programId,
    program_name: String(formData.get("program_name") ?? "").trim() || null,
    cover_title: String(formData.get("cover_title") ?? "").trim() || null,
    cover_subtitle: String(formData.get("cover_subtitle") ?? "").trim() || null,
    client_logo: String(formData.get("client_logo") ?? "").trim() || null,
    brand_attribution: String(formData.get("brand_attribution") ?? "salestrack"),
    accent,
    created_by: m.userId,
  };

  // Edita o rascunho não-aprovado existente; senão cria novo (aprovado é imutável).
  const { data: draft } = await sb.from("programa_identidade").select("id").eq("program_id", programId).neq("status", "aprovado").is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (draft) { await sb.from("programa_identidade").update(patch).eq("id", draft.id); await auditService("identidade.edit", "programa_identidade", draft.id, {}, proj.org_id); }
  else { const { data: ins } = await sb.from("programa_identidade").insert(patch).select("id").single(); await auditService("identidade.create", "programa_identidade", ins?.id, {}, proj.org_id); }
  revalidatePath("/admin/entregaveis/identidade");
}

/** Aprova + ATIVA a identidade (trava conteúdo; desativa as demais do programa). */
export async function activateIdentityAction(id: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: idn } = await sb.from("programa_identidade").select("org_id, program_id, status").eq("id", id).single();
  if (!idn) throw new Error("Identidade não encontrada.");
  await sb.from("programa_identidade").update({ active: false }).eq("program_id", idn.program_id).neq("id", id);
  await sb.from("programa_identidade").update({ status: "aprovado", approved_by: m.userId, approved_at: new Date().toISOString(), active: true }).eq("id", id);
  await auditService("identidade.activate", "programa_identidade", id, {}, idn.org_id);
  revalidatePath("/admin/entregaveis/identidade");
}
