"use server";
/**
 * Regras próprias do agregado Programa (o kit R2.1 cobre os metadados; aqui vai o específico):
 * cascata lógica de soft delete/restore (pai→filhos), duplicação PROFUNDA, criação em branco,
 * e o CRUD aninhado da ESTRUTURA (fases em timeline jsonb + entregáveis + passo do ciclo).
 * Tudo admin-only, auditado, sob RLS por org.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { duplicateCopy } from "./types";
import { programaResource } from "./resources/programa";
import type { CrudResult } from "./actions";

type Phase = { n: number; titulo: string; meses: number; descricao: string };

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}
function rev(id?: string) { revalidatePath("/admin/programas"); if (id) revalidatePath(`/admin/programas/${id}/editar`); }
const num = (v: FormDataEntryValue | null, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Excluir programa (soft) + cascata lógica nos entregáveis. */
export async function removeProgramaCascade(id: string): Promise<CrudResult> {
  try {
    await requireAdmin();
    const sb = await createClient();
    const now = new Date().toISOString();
    const { error } = await sb.from("projects").update({ deleted_at: now }).eq("id", id);
    if (error) throw new Error(error.message);
    await sb.from("deliverables").update({ deleted_at: now }).eq("project_id", id).is("deleted_at", null);
    await audit("programa.remove", "projects", id, { cascade: "deliverables" });
    rev(id);
    return { ok: true, id, message: programaResource.labels.removed };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

/** Restaurar programa + filhos (reverte a cascata). */
export async function restoreProgramaCascade(id: string): Promise<CrudResult> {
  try {
    await requireAdmin();
    const sb = await createClient();
    const { error } = await sb.from("projects").update({ deleted_at: null }).eq("id", id);
    if (error) throw new Error(error.message);
    await sb.from("deliverables").update({ deleted_at: null }).eq("project_id", id);
    await audit("programa.restore", "projects", id);
    rev(id);
    return { ok: true, id, message: programaResource.labels.restored };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

/** Excluir permanentemente (só programa já soft-deletado) — apaga filhos e o programa. */
export async function hardDeletePrograma(id: string): Promise<CrudResult> {
  try {
    await requireAdmin();
    const sb = await createClient();
    const { data: p } = await sb.from("projects").select("deleted_at").eq("id", id).maybeSingle();
    if (!p?.deleted_at) throw new Error("Exclua primeiro (fica recuperável) e só então exclua permanentemente.");
    await sb.from("deliverables").delete().eq("project_id", id);
    const { error } = await sb.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await audit("programa.hard_delete", "projects", id);
    rev();
    return { ok: true, message: "Programa excluído permanentemente." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

/** Duplicação PROFUNDA: clona metadados + estrutura (fases jsonb viajam junto) + entregáveis vivos. */
export async function duplicateProgramaDeep(id: string): Promise<CrudResult> {
  try {
    await requireAdmin();
    const sb = await createClient();
    const { data: orig, error: e1 } = await sb.from("projects").select("*").eq("id", id).single();
    if (e1 || !orig) throw new Error("Programa não encontrado.");
    const copy = duplicateCopy(programaResource, orig);
    copy.status = "onboarding"; copy.activated_at = null; copy.activated_by = null; copy.progress_pct = 0;
    const { data: created, error: e2 } = await sb.from("projects").insert(copy).select("id").single();
    if (e2) throw new Error(e2.message);
    const newId = created.id as string;
    const { data: dels } = await sb.from("deliverables").select("*").eq("project_id", id).is("deleted_at", null);
    if (dels?.length) {
      const clones = dels.map((d) => { const c: Record<string, unknown> = { ...d }; delete c.id; delete c.created_at; delete c.deleted_at; delete c.delivered_at; delete c.artifact_asset_id; c.project_id = newId; c.status = "planejado"; return c; });
      await sb.from("deliverables").insert(clones);
    }
    await audit("programa.duplicate_deep", "projects", newId, { from: id, deliverables: dels?.length ?? 0 });
    rev();
    return { ok: true, id: newId, message: programaResource.labels.duplicated };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

/** Criar programa EM BRANCO (esqueleto mínimo) para uma org cliente. */
export async function createBlankPrograma(formData: FormData): Promise<CrudResult> {
  try {
    await requireAdmin();
    const orgId = str(formData.get("org_id"));
    const name = str(formData.get("name"));
    if (!orgId) throw new Error("Escolha o cliente.");
    if (name.length < 2) throw new Error("Dê um nome ao programa.");
    const sb = await createClient();
    const { data, error } = await sb.from("projects").insert({ org_id: orgId, name, status: "onboarding", timeline: [], progress_pct: 0, cycle_step: 0 }).select("id").single();
    if (error) throw new Error(error.message);
    await audit("programa.create_blank", "projects", data.id, { org_id: orgId });
    rev();
    return { ok: true, id: data.id as string, message: programaResource.labels.created };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

// ── Estrutura: passo do ciclo ──
export async function setCycleStep(projectId: string, step: number): Promise<CrudResult> {
  try {
    await requireAdmin();
    const s = Math.max(0, Math.min(4, Math.round(step)));
    const sb = await createClient();
    const { error } = await sb.from("projects").update({ cycle_step: s }).eq("id", projectId);
    if (error) throw new Error(error.message);
    await audit("programa.cycle_step", "projects", projectId, { step: s });
    rev(projectId);
    return { ok: true, message: "Passo do ciclo atualizado." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

// ── Estrutura: fases (timeline jsonb) — CRUD aninhado + reordenar ──
async function getPhases(projectId: string): Promise<Phase[]> {
  const sb = await createClient();
  const { data } = await sb.from("projects").select("timeline").eq("id", projectId).single();
  return Array.isArray(data?.timeline) ? (data!.timeline as Phase[]) : [];
}
async function savePhases(projectId: string, phases: Phase[]) {
  const renum = phases.map((p, i) => ({ ...p, n: i + 1 }));
  const sb = await createClient();
  const { error } = await sb.from("projects").update({ timeline: renum }).eq("id", projectId);
  if (error) throw new Error(error.message);
}

export async function addPhase(projectId: string, formData: FormData): Promise<CrudResult> {
  try {
    await requireAdmin();
    const titulo = str(formData.get("titulo"));
    if (titulo.length < 2) throw new Error("Dê um título à fase.");
    const phases = await getPhases(projectId);
    phases.push({ n: phases.length + 1, titulo, meses: num(formData.get("meses"), 1), descricao: str(formData.get("descricao")) });
    await savePhases(projectId, phases);
    await audit("programa.phase_add", "projects", projectId, { titulo });
    rev(projectId);
    return { ok: true, message: "Fase adicionada." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
export async function updatePhase(projectId: string, index: number, formData: FormData): Promise<CrudResult> {
  try {
    await requireAdmin();
    const phases = await getPhases(projectId);
    if (!phases[index]) throw new Error("Fase não encontrada.");
    phases[index] = { ...phases[index], titulo: str(formData.get("titulo")) || phases[index].titulo, meses: num(formData.get("meses"), phases[index].meses), descricao: str(formData.get("descricao")) };
    await savePhases(projectId, phases);
    await audit("programa.phase_update", "projects", projectId, { index });
    rev(projectId);
    return { ok: true, message: "Fase salva." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
export async function removePhase(projectId: string, index: number): Promise<CrudResult> {
  try {
    await requireAdmin();
    const phases = await getPhases(projectId);
    phases.splice(index, 1);
    await savePhases(projectId, phases);
    await audit("programa.phase_remove", "projects", projectId, { index });
    rev(projectId);
    return { ok: true, message: "Fase removida." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
/** Condução: marca o status de um marco (concluído/atual/previsto). Um único 'atual' por programa. Reflete no portal. */
export async function markPhase(projectId: string, index: number, status: "concluido" | "atual" | "previsto"): Promise<CrudResult> {
  try {
    await requireAdmin();
    const phases = await getPhases(projectId) as (Phase & { status?: string; occurred_at?: string | null })[];
    if (!phases[index]) throw new Error("Marco não encontrado.");
    if (status === "atual") phases.forEach((p, i) => { if (i !== index && p.status === "atual") p.status = "concluido"; });
    phases[index].status = status;
    phases[index].occurred_at = status === "concluido" ? new Date().toISOString() : phases[index].occurred_at ?? null;
    await savePhases(projectId, phases);
    await audit("programa.phase_status", "projects", projectId, { index, status });
    rev(projectId);
    return { ok: true, message: status === "concluido" ? "Marco concluído." : status === "atual" ? "Você está aqui atualizado." : "Marco marcado como previsto." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function movePhase(projectId: string, index: number, dir: -1 | 1): Promise<CrudResult> {
  try {
    await requireAdmin();
    const phases = await getPhases(projectId);
    const j = index + dir;
    if (j < 0 || j >= phases.length) return { ok: true, message: "" };
    [phases[index], phases[j]] = [phases[j], phases[index]];
    await savePhases(projectId, phases);
    rev(projectId);
    return { ok: true, message: "Ordem atualizada." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

// ── Estrutura: entregáveis (tabela filha, soft delete) ──
export async function addDeliverable(projectId: string, orgId: string, formData: FormData): Promise<CrudResult> {
  try {
    await requireAdmin();
    const title = str(formData.get("title"));
    if (title.length < 2) throw new Error("Dê um título ao entregável.");
    const sb = await createClient();
    const { error } = await sb.from("deliverables").insert({ project_id: projectId, org_id: orgId, title, frente: str(formData.get("frente")) || null, status: "planejado" });
    if (error) throw new Error(error.message);
    await audit("programa.deliverable_add", "deliverables", projectId, { title });
    rev(projectId);
    return { ok: true, message: "Entregável adicionado." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
export async function updateDeliverable(projectId: string, id: string, formData: FormData): Promise<CrudResult> {
  try {
    await requireAdmin();
    const sb = await createClient();
    const { error } = await sb.from("deliverables").update({ title: str(formData.get("title")), frente: str(formData.get("frente")) || null, status: str(formData.get("status")) || "planejado" }).eq("id", id);
    if (error) throw new Error(error.message);
    await audit("programa.deliverable_update", "deliverables", id);
    rev(projectId);
    return { ok: true, message: "Entregável salvo." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
export async function removeDeliverable(projectId: string, id: string): Promise<CrudResult> {
  try {
    await requireAdmin();
    const sb = await createClient();
    const { error } = await sb.from("deliverables").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await audit("programa.deliverable_remove", "deliverables", id);
    rev(projectId);
    return { ok: true, message: "Entregável removido." };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

// ── Wrappers void para uso direto como `form action` (form action não retorna valor) ──
export async function fAddPhase(projectId: string, formData: FormData) { await addPhase(projectId, formData); }
export async function fUpdatePhase(projectId: string, index: number, formData: FormData) { await updatePhase(projectId, index, formData); }
export async function fRemovePhase(projectId: string, index: number) { await removePhase(projectId, index); }
export async function fMovePhase(projectId: string, index: number, dir: -1 | 1) { await movePhase(projectId, index, dir); }
export async function fAddDeliverable(projectId: string, orgId: string, formData: FormData) { await addDeliverable(projectId, orgId, formData); }
export async function fUpdateDeliverable(projectId: string, id: string, formData: FormData) { await updateDeliverable(projectId, id, formData); }
export async function fRemoveDeliverable(projectId: string, id: string) { await removeDeliverable(projectId, id); }
export async function fMarkPhase(projectId: string, index: number, status: "concluido" | "atual" | "previsto") { await markPhase(projectId, index, status); }
