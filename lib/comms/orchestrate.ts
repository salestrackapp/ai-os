import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { sendOne } from "./send";
import { stepCompleteness, assetTypeIsMessage, ASSET_TYPES, type ReguaStep } from "./regua";
import { resolverDestinatarios, type Publico } from "./destinatarios";
import type { Gatilho } from "./triggers";

/** Chave de idempotência: um passo/destinatário só dispara UMA vez por instância de ciclo. */
export function idempotencyKey(programId: string, stepId: string, recipientId: string, cycleInstance: number): string {
  return `${programId}:${stepId}:${recipientId}:c${cycleInstance}`;
}

/**
 * Um passo está DUE?
 *
 * ── O gatilho de estado deixou de ser "futuro" ────────────────────────────────────────────────
 * Devolvia `false` para todo gatilho de estado, e a régua PADRÃO — a que todo programa novo herda —
 * traz um passo "Reengajar se inativo" com esse gatilho. Ou seja: cada cliente novo nascia com um
 * passo morto que a tela mostrava como qualquer outro. Documentar isso como limitação seria aceitar
 * multiplicar o defeito por cliente.
 *
 * `diasInativo` é calculado por quem chama (precisa de banco); aqui fica só a decisão.
 */
export function isDue(
  step: { cycle_step: number; gatilho: Gatilho },
  program: { cycle_step: number; diasInativo?: number | null },
  event?: string,
): boolean {
  const g = step.gatilho;
  if (event) return g.tipo === "evento" && g.evento === event; // gancho de evento
  if (g.tipo === "tempo") return program.cycle_step === step.cycle_step; // fase atingida
  if (g.tipo === "estado" && g.condicao === "inatividade") {
    /**
     * `null` significa "nunca houve atividade nenhuma", e NÃO conta como inatividade.
     *
     * A diferença é o que separa reengajar de importunar: quem sumiu depois de usar precisa de um
     * empurrão; quem nunca começou está esperando o programa arrancar, e cobrar retorno de alguém
     * que nunca entrou é constrangedor. Hoje o Portal tem zero acessos — sem esta regra, ligar o
     * gatilho enfileiraria reengajamento para a base inteira de uma vez.
     */
    if (program.diasInativo == null) return false;
    return program.diasInativo >= (g.dias_limite ?? 10);
  }
  return false; // baixo_engajamento continua sem avaliação — e a tela avisa
}

const CANAL_OF: Record<string, "whatsapp" | "email" | null> = { whatsapp: "whatsapp", email: "email" };
function canalFor(assetType: string): "whatsapp" | "email" | null { return CANAL_OF[assetType] ?? null; }

type Recipient = { contactId: string; nome?: string; email?: string; phone?: string; optIn: boolean };

/**
 * Quando o passo deve sair.
 *
 * ── O defeito que isto corrige ────────────────────────────────────────────────────────────────
 * `scheduled_for` tinha default `now()` e ninguém escrevia nada nele, então o campo `offset_dias`
 * — que o editor coleta e a régua padrão usa — era puro enfeite. Na prática, "recapitulação 7 dias
 * após o início da fase" saía no mesmo instante em que a fase começava, e o lembrete de sessão
 * marcado para um dia ANTES saía junto com o agendamento.
 *
 * Offset negativo só faz sentido com uma data de referência (a sessão, o marco). Sem ela, cai para
 * agora — e é o certo: um lembrete atrasado ainda serve, um lembrete que nunca sai não.
 */
export function quandoEnviar(gatilho: Gatilho, refDate?: string | null): string {
  const dias = gatilho.tipo === "tempo" ? (gatilho.offset_dias ?? 0) : 0;
  if (gatilho.tipo === "tempo" && gatilho.quando === "data_fixa" && gatilho.data) {
    return new Date(`${gatilho.data}T09:00:00-03:00`).toISOString();
  }
  const base = refDate ? new Date(refDate).getTime() : Date.now();
  return new Date(base + dias * 86400000).toISOString();
}

/**
 * Avalia a régua de UM programa e ENFILEIRA os passos devidos (idempotente + gate).
 * event = gancho (entregavel_aprovado/marco_concluido/...); sem event = scheduler (tempo).
 */
/**
 * Há quantos dias esta organização não dá sinal de vida? `null` = nunca deu nenhum.
 *
 * Olha três fontes porque cliente ativo não se manifesta só de um jeito: entrar no Portal, aparecer
 * numa sessão e responder uma mensagem contam igual. Usar só o Portal marcaria como sumido quem
 * conversa por e-mail toda semana.
 */
export async function diasSemAtividade(orgId: string): Promise<number | null> {
  const sb = createServiceClient();
  const [portal, sessao, conversa] = await Promise.all([
    sb.from("portal_access_log").select("created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("sessions").select("scheduled_at").eq("org_id", orgId).eq("status", "realizada").order("scheduled_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("rel_conversas").select("last_message_at").eq("client_id", orgId).order("last_message_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const datas = [portal.data?.created_at, sessao.data?.scheduled_at, conversa.data?.last_message_at]
    .filter(Boolean).map((d) => new Date(d as string).getTime());
  if (!datas.length) return null;
  return Math.floor((Date.now() - Math.max(...datas)) / 86400000);
}

export async function evaluateProgram(projectId: string, event?: string, refDate?: string | null): Promise<{ enqueued: number; skipped: number }> {
  const sb = createServiceClient();
  const { data: proj } = await sb.from("projects").select("id, org_id, status, cycle_step").eq("id", projectId).is("deleted_at", null).maybeSingle();
  if (!proj || proj.status === "encerrado") return { enqueued: 0, skipped: 0 };
  const { data: regua } = await sb.from("regua").select("id, paused").eq("scope", "program").eq("ref_id", projectId).is("deleted_at", null).eq("paused", false).limit(1).maybeSingle();
  if (!regua) return { enqueued: 0, skipped: 0 };
  const { data: steps } = await sb.from("regua_step").select("id, cycle_step, titulo, gatilho, asset_type, asset_ref, modo, ativo, publico, timing").eq("regua_id", regua.id).eq("ativo", true).is("deleted_at", null);
  const cycleInstance = proj.cycle_step ?? 0;

  // Só calcula inatividade se houver algum passo que dependa dela — é uma consulta a mais por org.
  const precisaInatividade = (steps ?? []).some((s) => (s.gatilho as { tipo?: string })?.tipo === "estado");
  const diasInativo = precisaInatividade ? await diasSemAtividade(proj.org_id) : null;

  let enqueued = 0, skipped = 0;
  for (const s of (steps ?? []) as (ReguaStep & { id: string; asset_ref: string | null; modo: string; publico: string })[]) {
    if (!isDue({ cycle_step: s.cycle_step, gatilho: s.gatilho as Gatilho }, { cycle_step: cycleInstance, diasInativo }, event)) { continue; }
    const canal = canalFor(s.asset_type);
    if (!canal) { skipped++; continue; } // só canais disparáveis aqui (whatsapp/email)
    // GATE: ativo aprovado + elegível
    const { data: asset } = s.asset_ref ? await sb.from("studio_deliverables").select("id, status, comm_eligible").eq("id", s.asset_ref).maybeSingle() : { data: null };
    if (stepCompleteness(s, asset).status !== "completo") { skipped++; continue; }

    // O público do passo é OBEDECIDO. Antes o motor lia o campo e mandava para todo mundo do mesmo
    // jeito — a tela mostrava "para cliente" e saía uma circular.
    const { destinatarios } = await resolverDestinatarios(proj.org_id, (s.publico ?? "cliente") as Publico, canal);
    if (!destinatarios.length) { skipped++; continue; }

    const quando = quandoEnviar(s.gatilho as Gatilho, refDate);
    for (const r of destinatarios) {
      const key = idempotencyKey(projectId, s.id, r.contactId, cycleInstance);
      const status = s.modo === "automatico" ? "agendado" : "aguardando_aprovacao";
      const { error } = await sb.from("comm_queue").insert({
        org_id: proj.org_id, program_id: projectId, regua_step_id: s.id, canal, recipient: r, asset_ref: s.asset_ref,
        idempotency_key: key, status, scheduled_for: quando,
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
