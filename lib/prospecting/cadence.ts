import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { rastrearLinks, pixelAbertura } from "./engajamento";
import { auditService } from "@/lib/audit";
import { canEnrollLive } from "./score";
import { generateOutreach } from "./agents";
import { sendGmail, googleConfigured } from "@/lib/google";
import { sendToContact } from "@/lib/whatsapp";
import type { CadenceStep } from "./types";

/**
 * Empurra para segunda o que cairia no fim de semana.
 *
 * A cadência agenda por deslocamento em dias — dia 0, 2, 4, 6… — e ninguém tinha visto o resultado
 * porque o motor nunca rodou. A prévia mostrou: numa inscrição de sexta, o convite de LinkedIn cai
 * no domingo e a ligação fria no sábado. E-mail de prospecção que chega no fim de semana é lido na
 * segunda junto com o resto da caixa, na melhor das hipóteses; ligação de sábado é invasão.
 *
 * O deslocamento preserva a ORDEM e o espaçamento relativo, porque move sempre para frente.
 */
export function diaUtil(d: Date): Date {
  const dia = d.getDay();
  if (dia === 6) return new Date(d.getTime() + 2 * 86400000);  // sábado → segunda
  if (dia === 0) return new Date(d.getTime() + 1 * 86400000);  // domingo → segunda
  return d;
}

const emDias = (n: number, base = Date.now()) => diaUtil(new Date(base + n * 86400000)).toISOString();

/** Inscreve um prospect numa cadência — BLOQUEIA se score < mínimo do ICP (regra de ouro do funil). */
export async function enrollProspect(prospectId: string, cadenceId: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = createServiceClient();
  const { data: p } = await sb.from("prospects").select("id, score, icp, status").eq("id", prospectId).single();
  if (!p) return { ok: false, reason: "Prospect não encontrado." };
  const gate = await canEnrollLive(p);
  if (!gate.ok) return { ok: false, reason: `Score ${p.score} abaixo do mínimo do ICP (${gate.min}). Prospecção é por sinal, não volume.` };
  const { data: cad } = await sb.from("cadences").select("steps").eq("id", cadenceId).single();
  const steps = (Array.isArray(cad?.steps) ? cad!.steps : []) as CadenceStep[];
  const next = emDias(steps[0]?.dia ?? 0);
  const { error } = await sb.from("cadence_enrollments").insert({ prospect_id: prospectId, cadence_id: cadenceId, current_step: 0, status: "ativa", next_action_at: next });
  if (error) return { ok: false, reason: error.message };
  await sb.from("prospects").update({ status: "em_cadencia" }).eq("id", prospectId);
  await auditService("cadence.enroll", "cadence_enrollments", prospectId, { cadenceId }, undefined);
  return { ok: true };
}

/** Pausa a cadência de um prospect (ex.: ao detectar resposta). */
export async function pauseEnrollments(prospectId: string, status: "pausada" | "respondida" = "pausada"): Promise<void> {
  const sb = createServiceClient();
  await sb.from("cadence_enrollments").update({ status }).eq("prospect_id", prospectId).in("status", ["ativa"]);
  await auditService("cadence.pause", "cadence_enrollments", prospectId, { status }, undefined);
}

/**
 * Processa os passos vencidos (chamado pelo cron). PORTÃO HUMANO: e-mail/WhatsApp gerados pelo agente
 * entram como RASCUNHO e NÃO são enviados automaticamente — viram tarefa na fila de aprovação.
 * LinkedIn/ligação são sempre tarefa manual.
 */
export async function processDueEnrollments(limit = 50): Promise<{ processed: number; drafts: number; tasks: number }> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: due } = await sb.from("cadence_enrollments").select("*").eq("status", "ativa").lte("next_action_at", nowIso).limit(limit);
  let processed = 0, drafts = 0, tasks = 0;
  for (const e of due ?? []) {
    const { data: cad } = await sb.from("cadences").select("steps").eq("id", e.cadence_id).single();
    const steps = (Array.isArray(cad?.steps) ? cad!.steps : []) as CadenceStep[];
    const step = steps[e.current_step];
    if (!step) { await sb.from("cadence_enrollments").update({ status: "concluida", next_action_at: null }).eq("id", e.id); continue; }

    const isAgentChannel = step.canal === "email" || step.canal === "whatsapp";
    if (isAgentChannel && step.tipo === "toque") {
      const gen = await generateOutreach(e.prospect_id, { channel: step.canal, modelo: step.modelo });
      await sb.from("cadence_step_log").insert({ enrollment_id: e.id, step_no: e.current_step, channel: step.canal, action: "rascunho_gerado", status: "tarefa_manual", message_id: gen.id });
      drafts++;
    } else {
      // LinkedIn / ligação / tarefa → tarefa manual na fila
      await sb.from("cadence_step_log").insert({ enrollment_id: e.id, step_no: e.current_step, channel: step.canal, action: step.modelo || "tarefa", status: "tarefa_manual" });
      tasks++;
    }

    // agenda o próximo passo
    const nextStep = steps[e.current_step + 1];
    if (nextStep) {
      const deltaDays = Math.max(0, (nextStep.dia ?? 0) - (step.dia ?? 0));
      await sb.from("cadence_enrollments").update({ current_step: e.current_step + 1, next_action_at: emDias(deltaDays) }).eq("id", e.id);
    } else {
      await sb.from("cadence_enrollments").update({ current_step: e.current_step + 1, status: "concluida", next_action_at: null }).eq("id", e.id);
    }
    processed++;
  }
  return { processed, drafts, tasks };
}

/**
 * O aviso de LGPD já pode ser dado por cumprido?
 *
 * Par de `deveEscreverRodape`: aquele decide se o texto sai, este decide se a obrigação foi
 * cumprida. Separados porque escrever e entregar são momentos diferentes — e foi exatamente essa
 * distância que o código anterior ignorava, marcando como avisado quem só teve um rascunho
 * reprovado.
 *
 * `manual` não conta: sem canal configurado, ninguém sabe se a mensagem foi copiada e enviada.
 */
export function deveCarimbarAviso(r: { enviado: boolean; manual: boolean; avisoEm: string | null }): boolean {
  return r.enviado && !r.manual && !r.avisoEm;
}

/** Envia uma mensagem APROVADA pelo canal (Gmail/Z-API). Sem env de canal → marca como tarefa manual. */
export async function deliverApproved(messageId: string, approverId: string): Promise<{ sent: boolean; manual?: boolean }> {
  const sb = createServiceClient();
  const { data: msg } = await sb.from("outreach_messages").select("*").eq("id", messageId).single();
  if (!msg) return { sent: false };
  const { data: p } = await sb.from("prospects").select("email, phone, name, account_id").eq("id", msg.prospect_id).single();

  let sent = false, manual = false;
  if (msg.channel === "email") {
    if ((await googleConfigured()) && p?.email) {
      /**
       * O corpo é instrumentado só AQUI, na hora de enviar — não no rascunho.
       *
       * Se os links fossem reescritos na geração, quem revisa a mensagem na fila de aprovação
       * veria URLs opacas de rastreio em vez do destino real, e não teria como julgar se o link
       * está certo. O revisor precisa ver o link que a pessoa vai receber.
       */
      const comLinks = await rastrearLinks(msg.body ?? "", { prospectId: msg.prospect_id, messageId });
      const pixel = await pixelAbertura({ prospectId: msg.prospect_id, messageId });
      const r = await sendGmail(p.email, msg.subject ?? "", comLinks + pixel);
      sent = r.sent;
    }
    else manual = true;
  } else if (msg.channel === "whatsapp") {
    // WhatsApp comercial exige telefone; opt-in não se aplica a prospect frio → registra como tarefa manual se não houver via segura
    if (p?.phone) { const r = await sendToContact({ phone: p.phone, optIn: true, body: msg.body ?? "" }); sent = r.sent; }
    else manual = true;
  } else manual = true;

  await sb.from("outreach_messages").update({ status: sent ? "enviada" : "aprovada", approved_by: approverId, sent_at: sent ? new Date().toISOString() : null }).eq("id", messageId);

  /**
   * O aviso de LGPD só conta como dado depois que a mensagem SAIU.
   *
   * O rodapé de transparência é escrito na geração (para quem revisa poder ver o que a pessoa vai
   * receber), mas o carimbo é aqui. Carimbar na geração marcava como avisado quem só teve um
   * rascunho reprovado — e o contato seguinte, o real, sairia sem o aviso.
   *
   * `manual` não carimba de propósito: sem canal configurado, não sabemos se alguém copiou e
   * mandou. Diante da dúvida, o próximo rascunho traz o rodapé de novo. Repetir o aviso incomoda;
   * não avisar quebra a base legal.
   */
  if (deveCarimbarAviso({ enviado: sent, manual, avisoEm: null })) {
    // O `is("aviso_em", null)` é a outra metade da condição, aplicada no próprio UPDATE: quem já
    // tinha data mantém a do PRIMEIRO contato, que é a que interessa numa eventual auditoria.
    await sb.from("prospects")
      .update({ aviso_em: new Date().toISOString() })
      .eq("id", msg.prospect_id).is("aviso_em", null);
  }

  if (sent) {
    await sb.from("timeline_events").insert({ subject_type: "prospect", subject_id: msg.prospect_id, source: "cadence", kind: "toque", summary: `${msg.channel}: ${msg.subject ?? (msg.body ?? "").slice(0, 60)}`, occurred_at: new Date().toISOString() });
  }
  await auditService(sent ? "outreach.sent" : "outreach.approved_manual", "outreach_messages", messageId, { channel: msg.channel, sent, manual }, undefined);
  return { sent, manual };
}
