"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { DEAL_STAGES } from "@/lib/types";

const ALL_STAGES = [...DEAL_STAGES, "perdido"] as const;

/** Registra uma atividade do deal (dispara trigger que atualiza last_activity_at). */
async function logActivity(orgId: string | null, dealId: string, kind: string, payload: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("activities").insert({
    org_id: orgId, actor_id: user?.id ?? null, kind,
    ref_table: "deals", ref_id: dealId, payload,
  });
}

/** Move um deal para um estágio destino (drag & drop). */
export async function moveDealToStage(id: string, stage: string) {
  if (!ALL_STAGES.includes(stage as (typeof ALL_STAGES)[number])) return;
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("stage, org_id").eq("id", id).single();
  if (!deal || deal.stage === stage) return;
  await supabase.from("deals").update({ stage }).eq("id", id);
  await logActivity(deal.org_id, id, "estagio", { from: deal.stage, to: stage });
  await audit("deal.stage_change", "deals", id, { from: deal.stage, to: stage });
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${id}`);
}

/** Compat: mover por direção (mantido para formulários simples). */
export async function moveDeal(id: string, direction: "next" | "prev") {
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("stage").eq("id", id).single();
  if (!deal) return;
  const idx = DEAL_STAGES.indexOf(deal.stage as (typeof DEAL_STAGES)[number]);
  if (idx === -1) return;
  const next = direction === "next" ? Math.min(idx + 1, DEAL_STAGES.length - 1) : Math.max(idx - 1, 0);
  if (next === idx) return;
  await moveDealToStage(id, DEAL_STAGES[next]);
}

export async function markLost(id: string, reason: string) {
  const clean = reason?.trim();
  if (!clean) throw new Error("Motivo da perda é obrigatório.");
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("org_id, stage").eq("id", id).single();
  await supabase.from("deals").update({ stage: "perdido", lost_reason: clean }).eq("id", id);
  await logActivity(deal?.org_id ?? null, id, "sistema", { event: "perdido", reason: clean, from: deal?.stage });
  await audit("deal.lost", "deals", id, { reason: clean });
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${id}`);
}

export async function createDeal(formData: FormData) {
  const supabase = await createClient();
  const deal = {
    title: String(formData.get("title")),
    icp: formData.get("icp") ? Number(formData.get("icp")) : null,
    brand: String(formData.get("brand") ?? "andre_kachan"),
    score: formData.get("score") ? Number(formData.get("score")) : 0,
    value_estimated: formData.get("value") ? Number(String(formData.get("value")).replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
    stage: "sinal",
  };
  const { data, error } = await supabase.from("deals").insert(deal).select("id").single();
  if (error) throw new Error(error.message);
  await audit("deal.create", "deals", data.id, deal);
  revalidatePath("/admin/crm");
}

export async function updateDeal(id: string, formData: FormData) {
  const supabase = await createClient();
  const val = (k: string) => { const v = formData.get(k); return v === null || String(v).trim() === "" ? null : String(v); };
  const patch = {
    title: val("title") ?? undefined,
    stage: val("stage") ?? undefined,
    brand: val("brand") ?? undefined,
    icp: formData.get("icp") ? Number(formData.get("icp")) : null,
    value_estimated: formData.get("value") ? Number(String(formData.get("value")).replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
    expected_close: val("expected_close"),
    next_step: val("next_step"),
  };
  const { error } = await supabase.from("deals").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("deal.update", "deals", id, patch);
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
}

/** Marca/desmarca sinais: grava ids em deals.signals e recalcula score = soma dos pesos. */
export async function setDealSignals(id: string, signalIds: string[]) {
  const supabase = await createClient();
  const { data: defs } = await supabase.from("signal_definitions").select("id, weight").eq("active", true);
  const weightById = new Map((defs ?? []).map((d: { id: string; weight: number }) => [d.id, d.weight]));
  const valid = signalIds.filter((s) => weightById.has(s));
  const score = valid.reduce((sum, s) => sum + (weightById.get(s) ?? 0), 0);
  const { error } = await supabase.from("deals").update({ signals: valid, score }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("deal.signals", "deals", id, { signals: valid, score });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  return score;
}

export async function addNote(id: string, text: string) {
  const clean = text?.trim();
  if (!clean) return;
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("org_id").eq("id", id).single();
  await logActivity(deal?.org_id ?? null, id, "nota", { text: clean });
  await audit("deal.note", "deals", id, { text: clean });
  revalidatePath(`/admin/crm/${id}`);
}

export async function linkContact(id: string, contactId: string) {
  const supabase = await createClient();
  await supabase.from("deals").update({ contact_id: contactId || null }).eq("id", id);
  await audit("deal.link_contact", "deals", id, { contact_id: contactId || null });
  revalidatePath(`/admin/crm/${id}`);
}

/** Converte deal em cliente. Cria organização (onboarding) se ainda não houver org vinculada. */
export async function convertToClient(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("org_id, title").eq("id", id).single();
  let orgId = deal?.org_id ?? null;
  if (!orgId) {
    const name = String(formData.get("org_name") ?? "").trim() || deal?.title || "Nova organização";
    const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
    const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const slug = (base || "org") + "-" + Math.random().toString(36).slice(2, 8);
    const { data: org, error } = await supabase.from("organizations")
      .insert({ name, slug, cnpj, status: "onboarding", plan: "professional" }).select("id").single();
    if (error) throw new Error(error.message);
    orgId = org.id;
    await audit("org.create", "organizations", orgId, { name, cnpj, from_deal: id });
  }
  await supabase.from("deals").update({ stage: "cliente", org_id: orgId }).eq("id", id);
  await logActivity(orgId, id, "sistema", { event: "convertido_cliente", org_id: orgId });
  await audit("deal.convert_client", "deals", id, { org_id: orgId });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
}
