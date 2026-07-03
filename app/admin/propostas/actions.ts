"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { notifyAdmin, sendToContact } from "@/lib/whatsapp";
import { DEAL_STAGES } from "@/lib/types";

export type ProposalPayload = {
  title: string; deal_id?: string | null; client_name?: string | null; client_email?: string | null;
  valid_until?: string | null; frentes?: string[]; items?: unknown[]; timeline?: unknown[];
  platform_plan_md?: string | null; monthly_platform_fee?: number | null; installments?: number | null;
  roi_note?: string | null; conditions_md?: string | null;
};

function normalize(p: ProposalPayload) {
  return {
    title: (p.title ?? "").trim() || "Proposta sem título",
    deal_id: p.deal_id || null,
    client_name: p.client_name?.trim() || null,
    client_email: p.client_email?.trim() || null,
    valid_until: p.valid_until || null,
    frentes: p.frentes ?? [],
    items: p.items ?? [],
    timeline: p.timeline ?? [],
    platform_plan_md: p.platform_plan_md?.trim() || null,
    monthly_platform_fee: p.monthly_platform_fee != null ? Number(p.monthly_platform_fee) : null,
    installments: p.installments != null ? Number(p.installments) : null,
    roi_note: p.roi_note?.trim() || null,
    conditions_md: p.conditions_md?.trim() || null,
  };
}

async function orgOfDeal(dealId: string | null): Promise<string | null> {
  if (!dealId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("org_id").eq("id", dealId).single();
  return data?.org_id ?? null;
}

export async function createProposal(p: ProposalPayload) {
  const supabase = await createClient();
  const row = { ...normalize(p), org_id: await orgOfDeal(p.deal_id ?? null), version: 1, status: "rascunho" };
  const { data, error } = await supabase.from("proposals").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await audit("proposal.create", "proposals", data.id, { title: row.title });
  revalidatePath("/admin/propostas");
  redirect(`/admin/propostas/${data.id}`);
}

export async function updateProposal(id: string, p: ProposalPayload) {
  const supabase = await createClient();
  const { data: cur } = await supabase.from("proposals").select("status").eq("id", id).single();
  if (cur?.status !== "rascunho") throw new Error("Apenas propostas em rascunho podem ser editadas.");
  const { error } = await supabase.from("proposals").update(normalize(p)).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("proposal.update", "proposals", id, { title: p.title });
  revalidatePath(`/admin/propostas/${id}`);
}

export async function sendProposal(id: string) {
  const supabase = await createClient();
  const { data: prop } = await supabase.from("proposals").select("*").eq("id", id).single();
  if (!prop) throw new Error("Proposta não encontrada.");
  if (!["rascunho", "ajuste_solicitado"].includes(prop.status)) throw new Error("Proposta já enviada/decidida.");

  const patch: Record<string, unknown> = { status: "enviada", sent_at: new Date().toISOString() };
  if (!prop.access_token) patch.access_token = null; // default do banco gera; se null, regenera via SQL abaixo
  await supabase.from("proposals").update(patch).eq("id", id);
  // garante token
  let token = prop.access_token as string | null;
  if (!token) {
    const { data } = await supabase.from("proposals").select("access_token").eq("id", id).single();
    token = data?.access_token ?? null;
  }
  await audit("proposal.send", "proposals", id, { title: prop.title });

  // Move o deal para 'proposta' (se estiver antes) e registra atividade
  if (prop.deal_id) {
    const { data: deal } = await supabase.from("deals").select("stage, org_id").eq("id", prop.deal_id).single();
    const idx = DEAL_STAGES.indexOf((deal?.stage ?? "") as (typeof DEAL_STAGES)[number]);
    const target = DEAL_STAGES.indexOf("proposta");
    if (idx !== -1 && idx < target) await supabase.from("deals").update({ stage: "proposta" }).eq("id", prop.deal_id);
    await supabase.from("activities").insert({ org_id: deal?.org_id ?? null, kind: "proposta", ref_table: "deals", ref_id: prop.deal_id, payload: { event: "proposta_enviada", proposal_id: id } });
  }

  // Notificações WhatsApp (modo degradado se sem envs)
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/p/${token ?? ""}`;
  await notifyAdmin(`📄 Proposta enviada: "${prop.title}"${prop.client_name ? ` para ${prop.client_name}` : ""}. Link: ${link}`);
  if (prop.deal_id) {
    const { data: deal } = await supabase.from("deals").select("contact_id, org_id").eq("id", prop.deal_id).single();
    if (deal?.contact_id) {
      const { data: c } = await supabase.from("contacts").select("phone, opt_in_whatsapp").eq("id", deal.contact_id).single();
      if (c?.phone) await sendToContact({ phone: c.phone, optIn: !!c.opt_in_whatsapp, body: `Olá! Sua proposta "${prop.title}" está pronta: ${link}`, orgId: deal.org_id, ref: { ref_table: "proposals", ref_id: id } });
    }
  }

  revalidatePath("/admin/propostas");
  revalidatePath(`/admin/propostas/${id}`);
}

export async function resendNotification(id: string) {
  const supabase = await createClient();
  const { data: prop } = await supabase.from("proposals").select("title, access_token, deal_id").eq("id", id).single();
  if (!prop) return;
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/p/${prop.access_token ?? ""}`;
  await notifyAdmin(`🔁 Reenvio — proposta "${prop.title}": ${link}`);
  if (prop.deal_id) {
    const { data: deal } = await supabase.from("deals").select("contact_id, org_id").eq("id", prop.deal_id).single();
    if (deal?.contact_id) {
      const { data: c } = await supabase.from("contacts").select("phone, opt_in_whatsapp").eq("id", deal.contact_id).single();
      if (c?.phone) await sendToContact({ phone: c.phone, optIn: !!c.opt_in_whatsapp, body: `Retomando: sua proposta "${prop.title}" — ${link}`, orgId: deal.org_id, ref: { ref_table: "proposals", ref_id: id } });
    }
  }
  await audit("proposal.resend", "proposals", id);
}

export async function newVersion(id: string) {
  const supabase = await createClient();
  const { data: prop } = await supabase.from("proposals").select("*").eq("id", id).single();
  if (!prop) throw new Error("Proposta não encontrada.");
  const clone = {
    org_id: prop.org_id, deal_id: prop.deal_id, version: (prop.version ?? 1) + 1, status: "rascunho",
    title: prop.title, frentes: prop.frentes, items: prop.items, timeline: prop.timeline,
    platform_plan_md: prop.platform_plan_md, monthly_platform_fee: prop.monthly_platform_fee,
    installments: prop.installments, roi_note: prop.roi_note, conditions_md: prop.conditions_md,
    client_name: prop.client_name, client_email: prop.client_email, valid_until: prop.valid_until,
  };
  const { data, error } = await supabase.from("proposals").insert(clone).select("id").single();
  if (error) throw new Error(error.message);
  await audit("proposal.new_version", "proposals", data.id, { previous_id: id, version: clone.version });
  revalidatePath("/admin/propostas");
  redirect(`/admin/propostas/${data.id}`);
}
