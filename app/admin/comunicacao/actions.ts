"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { gatilhoSchema, type Gatilho } from "@/lib/comms/triggers";
import { DEFAULT_REGUA_NOME, DEFAULT_REGUA_STEPS, instantiateSteps } from "@/lib/comms/regua";
import { instantiateReguaForProgram } from "@/lib/comms/instantiate";
import { approveQueueItem, cancelProgramQueue, retryQueueItem, evaluateProgram } from "@/lib/comms/orchestrate";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}
const R = () => revalidatePath("/admin/comunicacao");

/** Cria (uma vez) a régua-template padrão com seus passos. */
export async function seedDefaultTemplateAction() {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: existing } = await sb.from("regua").select("id").eq("scope", "program_template").is("deleted_at", null).limit(1).maybeSingle();
  if (existing) { R(); return; }
  const { data: reg } = await sb.from("regua").insert({ scope: "program_template", nome: DEFAULT_REGUA_NOME, created_by: m.userId }).select("id").single();
  if (reg) {
    await sb.from("regua_step").insert(instantiateSteps(DEFAULT_REGUA_STEPS, reg.id));
    await auditService("regua.seed_template", "regua", reg.id, { steps: DEFAULT_REGUA_STEPS.length }, undefined);
  }
  R();
}

/** Monta o gatilho a partir do form e valida (contrato R4.1). */
function gatilhoFromForm(fd: FormData): Gatilho {
  const tipo = String(fd.get("gatilho_tipo") ?? "tempo");
  const raw: Record<string, unknown> =
    tipo === "tempo" ? { tipo: "tempo", quando: String(fd.get("g_quando") ?? "apos_inicio_fase"), offset_dias: Number(fd.get("g_offset") ?? 0) }
      : tipo === "evento" ? { tipo: "evento", evento: String(fd.get("g_evento") ?? "entregavel_aprovado") }
        : { tipo: "estado", condicao: String(fd.get("g_condicao") ?? "inatividade"), dias_limite: Number(fd.get("g_dias") ?? 10) };
  const parsed = gatilhoSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Gatilho inválido: ${parsed.error.issues[0]?.message ?? ""}`);
  return parsed.data;
}

export async function addStepAction(reguaId: string, formData: FormData) {
  await requireAdmin();
  const sb = createServiceClient();
  const gatilho = gatilhoFromForm(formData);
  await sb.from("regua_step").insert({
    regua_id: reguaId, cycle_step: Number(formData.get("cycle_step") ?? 0),
    titulo: String(formData.get("titulo") ?? "Novo passo"), gatilho, asset_type: String(formData.get("asset_type") ?? "email"),
    publico: String(formData.get("publico") ?? "cliente"), ordem: 99,
  });
  await auditService("regua.step_add", "regua", reguaId, { gatilho: gatilho.tipo }, undefined);
  R();
}

export async function toggleStepAction(stepId: string, ativo: boolean) {
  await requireAdmin();
  const sb = createServiceClient();
  await sb.from("regua_step").update({ ativo }).eq("id", stepId);
  R();
}

export async function removeStepAction(stepId: string) {
  await requireAdmin();
  const sb = createServiceClient();
  await sb.from("regua_step").update({ deleted_at: new Date().toISOString() }).eq("id", stepId);
  await auditService("regua.step_remove", "regua_step", stepId, {}, undefined);
  R();
}

/** Vincula um ativo do Estúdio (aprovado) a um passo — o gate valida a aprovação na leitura. */
export async function bindAssetAction(stepId: string, formData: FormData) {
  await requireAdmin();
  const sb = createServiceClient();
  const assetRef = String(formData.get("asset_ref") ?? "") || null;
  await sb.from("regua_step").update({ asset_ref: assetRef }).eq("id", stepId);
  await auditService("regua.step_bind", "regua_step", stepId, { asset_ref: assetRef }, undefined);
  R();
}

export async function instantiateForProgramAction(projectId: string, orgId: string) {
  const m = await requireAdmin();
  await instantiateReguaForProgram(projectId, orgId, m.userId);
  R();
}

// ── R4.3 · Orquestração (fila de envio) ──
export async function avaliarAgoraAction(projectId: string) {
  await requireAdmin();
  await evaluateProgram(projectId);   // scheduler-style (tempo); eventos disparam via ganchos
  R();
}
export async function aprovarEnvioAction(itemId: string) {
  const m = await requireAdmin();
  await approveQueueItem(itemId, m.userId);
  R();
}
export async function cancelarItemAction(itemId: string) {
  await requireAdmin();
  const sb = createServiceClient();
  await sb.from("comm_queue").update({ status: "cancelado" }).eq("id", itemId).eq("status", "aguardando_aprovacao");
  R();
}
export async function retryEnvioAction(itemId: string) {
  const m = await requireAdmin();
  await retryQueueItem(itemId, m.userId);
  R();
}
export async function pausarProgramaAction(projectId: string) {
  await requireAdmin();
  await cancelProgramQueue(projectId); // kill switch: cancela agendados/aguardando
  const sb = createServiceClient();
  await sb.from("regua").update({ paused: true }).eq("scope", "program").eq("ref_id", projectId);
  R();
}
