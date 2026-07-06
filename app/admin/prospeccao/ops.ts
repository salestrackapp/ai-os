"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateDossier, generateOutreach, classifyResponse } from "@/lib/prospecting/agents";
import { enrollProspect, pauseEnrollments, deliverApproved, processDueEnrollments } from "@/lib/prospecting/cadence";
import { ingestProspectTimeline } from "@/lib/prospecting/timeline";
import { addToNurture } from "@/lib/mailerlite";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

export async function runDossier(prospectId: string) {
  await requireAdmin();
  await generateDossier(prospectId);
  revalidatePath(`/admin/prospeccao/${prospectId}`);
}

export async function runOutreach(prospectId: string, warm: boolean, channel: string) {
  await requireAdmin();
  await generateOutreach(prospectId, { warm, channel });
  revalidatePath(`/admin/prospeccao/${prospectId}`);
  revalidatePath("/admin/prospeccao/aprovacao");
}

export async function enrollInCadence(prospectId: string, formData: FormData) {
  await requireAdmin();
  const cadenceId = String(formData.get("cadence_id") ?? "");
  if (!cadenceId) throw new Error("Escolha uma cadência.");
  const r = await enrollProspect(prospectId, cadenceId);
  if (!r.ok) throw new Error(r.reason ?? "Não foi possível inscrever.");
  await audit("cadence.enroll_ui", "prospects", prospectId, { cadenceId }, undefined);
  revalidatePath(`/admin/prospeccao/${prospectId}`);
  revalidatePath("/admin/prospeccao");
}

export async function ingestTimeline(prospectId: string) {
  await requireAdmin();
  await ingestProspectTimeline(prospectId);
  revalidatePath(`/admin/prospeccao/${prospectId}`);
}

/** Registra manualmente uma resposta recebida → classifica → pausa cadência. */
export async function registerResponse(prospectId: string, formData: FormData) {
  await requireAdmin();
  const text = String(formData.get("response") ?? "").trim();
  if (!text) throw new Error("Cole o texto da resposta.");
  const svc = createServiceClient();
  await svc.from("timeline_events").insert({ subject_type: "prospect", subject_id: prospectId, source: "manual", kind: "resposta", summary: text.slice(0, 300) });
  const cls = await classifyResponse(prospectId, text);
  await pauseEnrollments(prospectId, cls.label === "positiva" || cls.label === "encaminhou" ? "respondida" : "pausada");
  const newStatus = cls.label === "positiva" ? "respondeu" : cls.label === "nao" ? "descartado" : cls.label === "fora_do_momento" ? "respondeu" : "respondeu";
  await svc.from("prospects").update({ status: newStatus }).eq("id", prospectId);
  await audit("prospect.response", "prospects", prospectId, { label: cls.label }, undefined);
  revalidatePath(`/admin/prospeccao/${prospectId}`);
}

export async function convertToDeal(prospectId: string) {
  const m = await requireAdmin();
  const sb = await createClient();
  const { data: p } = await sb.from("prospects").select("*").eq("id", prospectId).single();
  if (!p) throw new Error("Prospect não encontrado.");
  if (p.deal_id) throw new Error("Já convertido.");
  let accName = p.name;
  if (p.account_id) { const { data: a } = await sb.from("prospect_accounts").select("name").eq("id", p.account_id).single(); accName = a?.name ?? accName; }
  const { data: deal, error } = await sb.from("deals").insert({
    title: `${accName} — ${p.name}`, stage: "qualificado", brand: "andre_kachan",
    icp: p.icp === "icp1" ? 1 : p.icp === "icp2" ? 2 : p.icp === "icp3" ? 3 : null,
    score: p.score, next_step: "Primeira conversa (origem: prospecção)",
  }).select("id").single();
  if (error) throw new Error(error.message);
  await sb.from("prospects").update({ deal_id: deal.id, status: "virou_deal" }).eq("id", prospectId);
  await audit("prospect.convert_deal", "deals", deal.id, { prospectId }, undefined);
  revalidatePath(`/admin/prospeccao/${prospectId}`);
  revalidatePath("/admin/crm");
}

export async function markNurture(prospectId: string) {
  await requireAdmin();
  const svc = createServiceClient();
  const { data: p } = await svc.from("prospects").select("email, name, account_id").eq("id", prospectId).single();
  let company: string | null = null;
  if (p?.account_id) { const { data: a } = await svc.from("prospect_accounts").select("name").eq("id", p.account_id).single(); company = a?.name ?? null; }
  const added = await addToNurture({ email: p?.email, name: p?.name, company });
  await svc.from("timeline_events").insert({ subject_type: "prospect", subject_id: prospectId, source: "manual", kind: "nota", summary: added ? "Adicionado ao nurture (MailerLite)." : "Marcado para nurture (modo manual — exportar segmento)." });
  await audit("prospect.nurture", "prospects", prospectId, { added }, undefined);
  revalidatePath(`/admin/prospeccao/${prospectId}`);
}

// ----- Fila de aprovação -----
export async function approveAndSend(messageId: string) {
  const m = await requireAdmin();
  await deliverApproved(messageId, m.userId);
  revalidatePath("/admin/prospeccao/aprovacao");
}
export async function saveDraft(messageId: string, formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  await sb.from("outreach_messages").update({ subject, body }).eq("id", messageId);
  await audit("outreach.edit", "outreach_messages", messageId, null, undefined);
  revalidatePath("/admin/prospeccao/aprovacao");
}
export async function rejectDraft(messageId: string) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("outreach_messages").update({ status: "reprovada" }).eq("id", messageId);
  await audit("outreach.reject", "outreach_messages", messageId, null, undefined);
  revalidatePath("/admin/prospeccao/aprovacao");
}

// ----- Editor de cadências -----
export async function saveCadence(formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const icp = String(formData.get("icp") ?? "") || null;
  if (!name) throw new Error("Nome é obrigatório.");
  let steps: unknown = [];
  try { steps = JSON.parse(String(formData.get("steps") ?? "[]")); } catch { throw new Error("Passos: JSON inválido."); }
  if (!Array.isArray(steps)) throw new Error("Passos deve ser uma lista JSON.");
  const row = { name, icp, steps };
  if (id) { const { error } = await sb.from("cadences").update(row).eq("id", id); if (error) throw new Error(error.message); }
  else { const { error } = await sb.from("cadences").insert({ ...row, is_active: true }); if (error) throw new Error(error.message); }
  await audit("cadence.save", "cadences", id || undefined, { name }, undefined);
  revalidatePath("/admin/prospeccao/cadencias");
}
export async function toggleCadence(id: string, next: boolean) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("cadences").update({ is_active: next }).eq("id", id);
  revalidatePath("/admin/prospeccao/cadencias");
}

/** Botão admin: processar cadências vencidas agora. */
export async function processCadencesNow() {
  await requireAdmin();
  await processDueEnrollments();
  revalidatePath("/admin/prospeccao/aprovacao");
  revalidatePath("/admin/prospeccao");
}
