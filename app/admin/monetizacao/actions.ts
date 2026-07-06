"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

/** Edita um plano (preço, stripe_price_id, features). */
export async function savePlan(planId: string, formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  const row: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    price_monthly: Number(String(formData.get("price_monthly") ?? "0")) || 0,
    stripe_price_id: String(formData.get("stripe_price_id") ?? "").trim() || null,
  };
  // features via checkboxes/números
  const feats: Record<string, unknown> = {};
  for (const f of ["playbook", "consultor", "sessoes", "roi", "whitelabel_n2", "whitelabel_n3", "governanca_avancada"]) feats[f] = formData.get(`f_${f}`) === "on";
  feats.limite_membros = Number(String(formData.get("f_limite_membros") ?? "5")) || 5;
  feats.creditos_sessao_mes = Number(String(formData.get("f_creditos_sessao_mes") ?? "0")) || 0;
  row.features = feats;
  const { error } = await sb.from("plans").update(row).eq("id", planId);
  if (error) throw new Error(error.message);
  await audit("plan.save", "plans", planId, { name: row.name }, undefined);
  revalidatePath("/admin/monetizacao");
}

/** Atribui/atualiza o plano de uma org (assinatura). Modo manual (sem Stripe) por padrão. */
export async function assignPlan(orgId: string, formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  const plan_key = String(formData.get("plan_key") ?? "base");
  const status = String(formData.get("status") ?? "ativa");
  const fee = Number(String(formData.get("monthly_platform_fee") ?? "0")) || 0;
  const { data: existing } = await sb.from("subscriptions").select("id").eq("org_id", orgId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const row = { org_id: orgId, plan_key, status, monthly_platform_fee: fee, updated_at: new Date().toISOString() };
  if (existing) await sb.from("subscriptions").update(row).eq("id", existing.id);
  else await sb.from("subscriptions").insert({ ...row, plan: plan_key === "pro" ? "professional" : plan_key === "enterprise" ? "enterprise" : "essential", monthly_amount: fee, started_at: new Date().toISOString() });
  await audit("subscription.assign", "subscriptions", orgId, { plan_key, status, fee }, orgId);
  revalidatePath("/admin/monetizacao");
}

/** Define nível e tema white-label do tenant. */
export async function saveBranding(orgId: string, formData: FormData) {
  await requireAdmin();
  const sb = await createClient();
  const row = {
    org_id: orgId,
    level: String(formData.get("level") ?? "n1_padrao"),
    internal_name: String(formData.get("internal_name") ?? "").trim() || null,
    logo_url: String(formData.get("logo_url") ?? "").trim() || null,
    color_primary: String(formData.get("color_primary") ?? "").trim() || null,
    color_accent: String(formData.get("color_accent") ?? "").trim() || null,
    custom_domain: String(formData.get("custom_domain") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("tenant_branding").upsert(row, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
  await audit("branding.save", "tenant_branding", orgId, { level: row.level }, orgId);
  revalidatePath("/admin/monetizacao");
}

/** Bloco 7: liga a proposta vendida à cobrança — cria assinatura pré-preenchida (plano + mensalidade da proposta). */
export async function subscriptionFromProposal(proposalId: string) {
  await requireAdmin();
  const { platformSubscriptionEnabled } = await import("@/lib/config");
  if (!platformSubscriptionEnabled()) throw new Error("Modelo atual sem mensalidade de plataforma — o faturamento segue a oferta vendida, fora do sistema.");
  const sb = await createClient();
  const { data: p } = await sb.from("proposals").select("org_id, monthly_platform_fee").eq("id", proposalId).single();
  if (!p?.org_id) throw new Error("Proposta sem conta vinculada.");
  const fee = Number(p.monthly_platform_fee ?? 0) || 0;
  const { data: existing } = await sb.from("subscriptions").select("id").eq("org_id", p.org_id).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const row = { org_id: p.org_id, plan_key: "pro", status: "ativa", monthly_platform_fee: fee, updated_at: new Date().toISOString() };
  if (existing) await sb.from("subscriptions").update(row).eq("id", existing.id);
  else await sb.from("subscriptions").insert({ ...row, plan: "professional", monthly_amount: fee, started_at: new Date().toISOString() });
  await audit("subscription.from_proposal", "subscriptions", p.org_id, { proposalId, fee }, p.org_id);
  revalidatePath("/admin/monetizacao");
}

/** Publica/despublica a página de Segurança/Governança do tenant. */
export async function toggleGovernance(orgId: string, next: boolean) {
  await requireAdmin();
  const sb = await createClient();
  await sb.from("governance_policies").upsert({ org_id: orgId, published: next, published_at: next ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  await audit(next ? "governance.publish" : "governance.unpublish", "governance_policies", orgId, null, orgId);
  revalidatePath("/admin/monetizacao");
}
