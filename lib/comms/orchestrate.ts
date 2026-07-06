import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { sendOne } from "./send";
import { stepCompleteness, assetTypeIsMessage, ASSET_TYPES, type ReguaStep } from "./regua";
import type { Gatilho } from "./triggers";

/** Chave de idempotência: um passo/destinatário só dispara UMA vez por instância de ciclo. */
export function idempotencyKey(programId: string, stepId: string, recipientId: string, cycleInstance: number): string {
  return `${programId}:${stepId}:${recipientId}:c${cycleInstance}`;
}

/** Um passo está DUE? (contrato R4.1 — avaliação simplificada; estado/tempo fino evolui depois.) */
export function isDue(step: { cycle_step: number; gatilho: Gatilho }, program: { cycle_step: number }, event?: string): boolean {
  const g = step.gatilho;
  if (event) return g.tipo === "evento" && g.evento === event; // gancho de evento
  if (g.tipo === "tempo") return program.cycle_step === step.cycle_step; // fase atingida
  return false; // 'estado'/'evento' só via gancho/scheduler-de-estado (futuro)
}

const CANAL_OF: Record<string, "whatsapp" | "email" | null> = { whatsapp: "whatsapp", email: "email" };
function canalFor(assetType: string): "whatsapp" | "email" | null { return CANAL_OF[assetType] ?? null; }

type Recipient = { contactId: string; nome?: string; email?: string; phone?: string; optIn: boolean };
async function orgRecipients(orgId: string, canal: "whatsapp" | "email"): Promise<Recipient[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("contacts").select("id, name, email, phone, opt_in_whatsapp").eq("org_id", orgId).limit(200);
  return (data ?? [])
    .filter((c) => (canal === "email" ? !!c.email : !!c.phone))
    .map((c) => ({ contactId: c.id, nome: c.name ?? undefined, email: c.email ?? undefined, phone: c.phone ?? undefined, optIn: canal === "whatsapp" ? !!c.opt_in_whatsapp : true }));
}

/**
 * Avalia a régua de UM programa e ENFILEIRA os passos devidos (idempotente + gate).
 * event = gancho (entregavel_aprovado/marco_concluido/...); sem event = scheduler (tempo).
 */
export async function evaluateProgram(projectId: string, event?: string): Promise<{ enqueued: number; skipped: number }> {
  const sb = createServiceClient();
  const { data: proj } = await sb.from("projects").select("id, org_id, status, cycle_step").eq("id", projectId).is("deleted_at", null).maybeSingle();
  if (!proj || proj.status === "encerrado") return { enqueued: 0, skipped: 0 };
  const { data: regua } = await sb.from("regua").select("id, paused").eq("scope", "program").eq("ref_id", projectId).is("deleted_at", null).eq("paused", false).limit(1).maybeSingle();
  if (!regua) return { enqueued: 0, skipped: 0 };
  const { data: steps } = await sb.from("regua_step").select("id, cycle_step, titulo, gatilho, asset_type, asset_ref, modo, ativo").eq("regua_id", regua.id).eq("ativo", true).is("deleted_at", null);
  const cycleInstance = proj.cycle_step ?? 0;

  let enqueued = 0, skipped = 0;
  for (const s of (steps ?? []) as (ReguaStep & { id: string; asset_ref: string | null; modo: string })[]) {
    if (!isDue({ cycle_step: s.cycle_step, gatilho: s.gatilho as Gatilho }, { cycle_step: cycleInstance }, event)) { continue; }
    const canal = canalFor(s.asset_type);
    if (!canal) { skipped++; continue; } // só canais disparáveis aqui (whatsapp/email)
    // GATE: ativo aprovado + elegível
    const { data: asset } = s.asset_ref ? await sb.from("studio_deliverables").select("id, status, comm_eligible").eq("id", s.asset_ref).maybeSingle() : { data: null };
    if (stepCompleteness(s, asset).status !== "completo") { skipped++; continue; }
    const recipients = await orgRecipients(proj.org_id, canal);
    for (const r of recipients) {
      const key = idempotencyKey(projectId, s.id, r.contactId, cycleInstance);
      const status = s.modo === "automatico" ? "agendado" : "aguardando_aprovacao";
      const { error } = await sb.from("comm_queue").insert({
        org_id: proj.org_id, program_id: projectId, regua_step_id: s.id, canal, recipient: r, asset_ref: s.asset_ref,
        idempotency_key: key, status,
      });
      if (!error) enqueued++; // conflito de idempotência → não duplica (silencioso)
    }
  }
  if (enqueued) await auditService("comm.evaluate", "comm_queue", undefined, { project: projectId, event: event ?? "scheduler", enqueued }, proj.org_id);
  return { enqueued, skipped };
}

/** Gancho de evento (chamado ao aprovar entregável / concluir marco / provisionar). Best-effort. */
export async function onProgramEvent(projectId: string | null | undefined, event: string): Promise<void> {
  if (!projectId) return;
  try { await evaluateProgram(projectId, event); } catch (e) { console.warn("[orchestrate] evento falhou:", (e as Error)?.message); }
}

/** Dispara UM item da fila via R4.2 (sendOne). Atualiza status + registro. */
export async function processQueueItem(itemId: string, actorId?: string | null): Promise<{ status: string; motivo?: string }> {
  const sb = createServiceClient();
  const { data: item } = await sb.from("comm_queue").select("*").eq("id", itemId).single();
  if (!item) return { status: "erro", motivo: "Item não encontrado." };
  if (item.status === "enviado") return { status: "enviado" }; // idempotente: não reenvia
  if (item.status === "cancelado") return { status: "cancelado" };
  const r = item.recipient as Recipient;
  const res = await sendOne({ deliverableId: item.asset_ref, canal: item.canal, recipient: { nome: r.nome, email: r.email, phone: r.phone }, optIn: r.optIn, actorId });
  const newStatus = res.status === "enviado" || res.status === "manual" ? "enviado" : res.status === "bloqueado" || res.status === "falhou" ? "falhou" : "agendado";
  await sb.from("comm_queue").update({ status: newStatus, tentativas: (item.tentativas ?? 0) + 1, erro: res.motivo ?? null, delivery_id: res.deliveryId ?? null, updated_at: new Date().toISOString() }).eq("id", itemId);
  await auditService("comm.dispatch", "comm_queue", itemId, { status: newStatus, canal: item.canal }, item.org_id);
  return { status: newStatus, motivo: res.motivo };
}

/** Aprova (supervisão) → dispara. */
export async function approveQueueItem(itemId: string, actorId?: string | null) {
  const sb = createServiceClient();
  const { data: item } = await sb.from("comm_queue").select("status").eq("id", itemId).single();
  if (!item || item.status !== "aguardando_aprovacao") return;
  return processQueueItem(itemId, actorId);
}

/** Kill switch por programa: cancela agendados/aguardando. */
export async function cancelProgramQueue(projectId: string) {
  const sb = createServiceClient();
  await sb.from("comm_queue").update({ status: "cancelado" }).eq("program_id", projectId).in("status", ["agendado", "aguardando_aprovacao"]);
  await auditService("comm.kill", "comm_queue", undefined, { project: projectId }, undefined);
}

/** Retry de falha (dead-letter após 3 tentativas). */
export async function retryQueueItem(itemId: string, actorId?: string | null) {
  const sb = createServiceClient();
  const { data: item } = await sb.from("comm_queue").select("status, tentativas").eq("id", itemId).single();
  if (!item || item.status !== "falhou") return;
  if ((item.tentativas ?? 0) >= 3) return; // dead-letter
  await sb.from("comm_queue").update({ status: "aguardando_aprovacao", erro: null }).eq("id", itemId);
  return processQueueItem(itemId, actorId);
}

/** Scheduler: avalia todos os programas ativos (tempo). Graceful. */
export async function runScheduler(): Promise<{ programs: number; enqueued: number }> {
  const sb = createServiceClient();
  const { data: projs } = await sb.from("projects").select("id").eq("status", "ativo").is("deleted_at", null).limit(500);
  let enqueued = 0;
  for (const p of projs ?? []) { const r = await evaluateProgram(p.id).catch(() => ({ enqueued: 0 })); enqueued += r.enqueued; }
  return { programs: (projs ?? []).length, enqueued };
}

/** Processa itens automáticos due (para o cron rodar após avaliar). */
export async function runAutomatics(): Promise<number> {
  const sb = createServiceClient();
  const { data: items } = await sb.from("comm_queue").select("id").eq("status", "agendado").lte("scheduled_for", new Date().toISOString()).limit(200);
  for (const it of items ?? []) await processQueueItem(it.id).catch(() => null);
  return (items ?? []).length;
}

export { ASSET_TYPES, assetTypeIsMessage };
