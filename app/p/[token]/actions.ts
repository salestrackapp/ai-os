"use server";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { notifyAdmin } from "@/lib/whatsapp";
import { emailAdmin } from "@/lib/email";
import { proposalHash } from "@/lib/proposal-hash";
import type { ProposalItem, TimelinePhase } from "@/lib/types";

const DECIDED = ["aprovada", "recusada"];

async function loadOpen(token: string) {
  const sb = createServiceClient();
  const { data } = await sb.from("proposals").select("*").eq("access_token", token).single();
  if (!data) throw new Error("Proposta não encontrada.");
  if (DECIDED.includes(data.status)) throw new Error("Esta proposta já foi decidida.");
  return { sb, prop: data };
}

function docOf(p: Record<string, unknown>) {
  return {
    title: p.title as string, client_name: p.client_name as string | null, valid_until: p.valid_until as string | null,
    frentes: p.frentes as string[] | null, items: (p.items as ProposalItem[]) ?? [], timeline: (p.timeline as TimelinePhase[]) ?? [],
    platform_plan_md: p.platform_plan_md as string | null, monthly_platform_fee: p.monthly_platform_fee as number | null,
    installments: p.installments as number | null, roi_note: p.roi_note as string | null, conditions_md: p.conditions_md as string | null,
    version: p.version as number,
  };
}

export async function approveProposal(token: string, input: { name: string; role: string }) {
  const name = input.name?.trim(), role = input.role?.trim();
  if (!name || !role) throw new Error("Nome e cargo são obrigatórios.");
  const { sb, prop } = await loadOpen(token);
  const hash = proposalHash(docOf(prop));
  // status + content_hash no MESMO update (após 'aprovada' a trigger trava a linha)
  const { error } = await sb.from("proposals").update({
    status: "aprovada", decided_at: new Date().toISOString(),
    content_hash: hash, decision_note: `Aprovada por ${name} (${role})`,
  }).eq("id", prop.id).in("status", ["enviada", "em_leitura", "ajuste_solicitado"]);
  if (error) throw new Error(error.message);
  await sb.from("proposal_events").insert({ proposal_id: prop.id, kind: "approved", payload: { name, role } });
  await auditService("proposal.approved", "proposals", prop.id, { name, role, hash });
  if (prop.deal_id) {
    await sb.from("deals").update({ stage: "fechamento" }).eq("id", prop.deal_id);
    await sb.from("activities").insert({ org_id: prop.org_id, kind: "proposta", ref_table: "deals", ref_id: prop.deal_id, payload: { event: "proposta_aprovada", by: name } });
  }
  await notifyAdmin(`✅ Proposta "${prop.title}" APROVADA por ${name} (${role}).`);
  await emailAdmin(`✅ Proposta aprovada — ${prop.title}`, "Proposta aprovada", `<p><b>${prop.title}</b> foi aprovada por <b>${name}</b> (${role}).</p><p>Próximo passo: gerar o contrato no painel.</p>`);
  return { ok: true };
}

export async function requestAdjust(token: string, input: { note: string }) {
  const note = input.note?.trim();
  if (!note) throw new Error("Justificativa é obrigatória.");
  const { sb, prop } = await loadOpen(token);
  await sb.from("proposals").update({ status: "ajuste_solicitado", decision_note: note, decided_at: new Date().toISOString() }).eq("id", prop.id);
  await sb.from("proposal_events").insert({ proposal_id: prop.id, kind: "adjust_requested", payload: { note } });
  await auditService("proposal.adjust_requested", "proposals", prop.id, { note });
  await notifyAdmin(`✏️ Ajuste solicitado na proposta "${prop.title}": ${note}`);
  await emailAdmin(`✏️ Ajuste solicitado — ${prop.title}`, "Ajuste solicitado", `<p>O cliente pediu ajuste em <b>${prop.title}</b>:</p><p>“${note}”</p>`);
  return { ok: true };
}

export async function refuseProposal(token: string, input: { note: string }) {
  const note = input.note?.trim();
  if (!note) throw new Error("Motivo é obrigatório.");
  const { sb, prop } = await loadOpen(token);
  await sb.from("proposals").update({ status: "recusada", decision_note: note, decided_at: new Date().toISOString() }).eq("id", prop.id);
  await sb.from("proposal_events").insert({ proposal_id: prop.id, kind: "refused", payload: { note } });
  await auditService("proposal.refused", "proposals", prop.id, { note });
  if (prop.deal_id) await sb.from("deals").update({ stage: "perdido", lost_reason: `Proposta recusada: ${note}` }).eq("id", prop.deal_id);
  await notifyAdmin(`❌ Proposta "${prop.title}" recusada: ${note}`);
  await emailAdmin(`❌ Proposta recusada — ${prop.title}`, "Proposta recusada", `<p><b>${prop.title}</b> foi recusada.</p><p>Motivo: “${note}”</p>`);
  return { ok: true };
}
