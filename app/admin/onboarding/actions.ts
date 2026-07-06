"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { provisionTenant, type ProvisionInput } from "@/lib/provisioning/provision";
import { googleConfigured, sendGmail } from "@/lib/google";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

/** Wizard → provisiona o tenant ponta a ponta. */
export async function provisionAction(formData: FormData) {
  const m = await requireAdmin();
  const input: ProvisionInput = {
    name: String(formData.get("name") ?? "").trim(),
    plan_key: String(formData.get("plan_key") ?? "base"),
    monthly_platform_fee: Number(String(formData.get("monthly_platform_fee") ?? "0")) || 0,
    template_key: String(formData.get("template_key") ?? "") || undefined,
    adminEmail: String(formData.get("admin_email") ?? "").trim() || undefined,
    brandingLevel: String(formData.get("branding_level") ?? "n1_padrao"),
    logo_url: String(formData.get("logo_url") ?? "").trim() || undefined,
    color_accent: String(formData.get("color_accent") ?? "").trim() || undefined,
    internal_name: String(formData.get("internal_name") ?? "").trim() || undefined,
    source: (String(formData.get("deal_id") ?? "") ? "deal" : "manual"),
    deal_id: String(formData.get("deal_id") ?? "") || null,
    createdBy: m.userId,
  };
  if (!input.name) throw new Error("Nome do cliente é obrigatório.");
  const r = await provisionTenant(input);
  await audit(r.ok ? "onboarding.provision" : "onboarding.provision_fail", "tenant_provisioning", r.provisioningId, { name: input.name }, r.orgId ?? undefined);
  revalidatePath("/admin/onboarding");
  redirect("/admin/onboarding");
}

/** Retoma um provisionamento que falhou (usa o input salvo). */
export async function retomarProvision(provId: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: p } = await sb.from("tenant_provisioning").select("input").eq("id", provId).single();
  const input = { ...(p?.input as ProvisionInput), provisioningId: provId, createdBy: m.userId };
  const r = await provisionTenant(input);
  await audit("onboarding.resume", "tenant_provisioning", provId, { ok: r.ok }, r.orgId ?? undefined);
  revalidatePath("/admin/onboarding");
}

/** Reverte um provisionamento INCOMPLETO (só se não estiver 'pronto') — remove a org e cascata. Auditado. */
export async function reverterProvision(provId: string) {
  await requireAdmin();
  const sb = createServiceClient();
  const { data: p } = await sb.from("tenant_provisioning").select("org_id, status").eq("id", provId).single();
  if (!p) throw new Error("Não encontrado.");
  if (p.status === "pronto") throw new Error("Provisionamento concluído não pode ser revertido por aqui.");
  if (p.org_id) {
    // segurança: só remove org em onboarding (nunca ativa)
    const { data: org } = await sb.from("organizations").select("status").eq("id", p.org_id).single();
    if (org?.status === "onboarding") await sb.from("organizations").delete().eq("id", p.org_id); // cascata remove projeto/entregáveis/convites/checklist
  }
  await sb.from("tenant_provisioning").update({ status: "falhou", org_id: null }).eq("id", provId);
  await audit("onboarding.revert", "tenant_provisioning", provId, null, undefined);
  revalidatePath("/admin/onboarding");
}

export async function resendInvite(inviteId: string) {
  await requireAdmin();
  const sb = await createClient();
  const { data: inv } = await sb.from("invites").select("*").eq("id", inviteId).single();
  if (!inv) throw new Error("Convite não encontrado.");
  const host = process.env.NEXT_PUBLIC_APP_HOST || process.env.NEXT_PUBLIC_SITE_URL || "";
  const base = host.startsWith("http") ? host : `https://${host}`;
  const link = `${base}/convite/${inv.token}`;
  if ((await googleConfigured())) await sendGmail(inv.email, "Seu acesso ao AI OS (reenvio)", `Olá,\n\nRetomando seu convite de acesso ao AI OS:\n${link}\n\nEquipe Salestrack`);
  await audit("invite.resend", "invites", inviteId, null, inv.org_id ?? undefined);
  revalidatePath("/admin/onboarding");
}
export async function revokeInvite(inviteId: string) {
  await requireAdmin();
  const sb = await createClient();
  const { data: inv } = await sb.from("invites").select("org_id").eq("id", inviteId).single();
  await sb.from("invites").delete().eq("id", inviteId);
  await audit("invite.revoke", "invites", inviteId, null, inv?.org_id ?? undefined);
  revalidatePath("/admin/onboarding");
}
