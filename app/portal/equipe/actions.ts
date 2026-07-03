"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

async function canManage(orgId: string): Promise<boolean> {
  const m = await currentMembership();
  if (!m) return false;
  if (m.isSalestrackAdmin) return true;
  return m.orgId === orgId && m.role === "client_admin";
}

export async function createClientInvite(orgId: string, formData: FormData) {
  if (!(await canManage(orgId))) throw new Error("Sem permissão.");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "client_member");
  if (!email || !["client_admin", "client_member"].includes(role)) throw new Error("E-mail e papel válidos são obrigatórios.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("invites").insert({ org_id: orgId, email, role, invited_by: user?.id ?? null }).select("token").single();
  if (error) throw new Error(error.message);

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/convite/${data.token}`;
  await sendEmail({
    to: email,
    subject: `Convite — programa ${org?.name ?? ""} no AI OS`,
    title: "Você foi convidado ao AI OS",
    bodyHtml: `<p>Você foi convidado a acessar o portal do programa <b>${org?.name ?? ""}</b> no AI Operation System.</p><p>Clique abaixo para criar sua conta e entrar.</p>`,
    cta: { label: "Aceitar convite", url: link },
  });
  await audit("invite.create", "invites", undefined, { email, role }, orgId);
  revalidatePath("/portal/equipe");
  revalidatePath("/admin/programas");
}

export async function resendInvite(inviteId: string) {
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invites").select("*").eq("id", inviteId).single();
  if (!inv || !(await canManage(inv.org_id))) throw new Error("Sem permissão.");
  const { data: org } = await supabase.from("organizations").select("name").eq("id", inv.org_id).single();
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/convite/${inv.token}`;
  await sendEmail({ to: inv.email, subject: `Convite — ${org?.name ?? ""} no AI OS`, title: "Seu convite continua válido", bodyHtml: `<p>Retomando seu convite para o programa <b>${org?.name ?? ""}</b>.</p>`, cta: { label: "Aceitar convite", url: link } });
  await audit("invite.resend", "invites", inviteId, null, inv.org_id);
  revalidatePath("/portal/equipe"); revalidatePath("/admin/programas");
}

export async function removeClientMember(userId: string, orgId: string) {
  if (!(await canManage(orgId))) throw new Error("Sem permissão.");
  const m = await currentMembership();
  if (m?.userId === userId) throw new Error("Você não pode remover a si mesmo.");
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  await audit("team.client_remove", "memberships", userId, null, orgId);
  revalidatePath("/portal/equipe");
}

/** Aceite público do convite: cria conta (ou reaproveita) + membership. */
export async function acceptInvite(token: string, password: string): Promise<{ email: string }> {
  const admin = createServiceClient();
  const { data: inv } = await admin.from("invites").select("*").eq("token", token).single();
  if (!inv) throw new Error("Convite inválido.");
  if (inv.accepted_at) throw new Error("Convite já utilizado.");
  if (new Date(inv.expires_at) < new Date()) throw new Error("Convite expirado.");
  if (!password || password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres.");

  // cria ou localiza o usuário
  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({ email: inv.email, password, email_confirm: true });
  if (created.error) {
    if (/registered|already|exists/i.test(created.error.message)) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === inv.email.toLowerCase())?.id;
      if (userId) await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }
    if (!userId) throw new Error(created.error.message);
  } else userId = created.data.user.id;

  await admin.from("memberships").upsert({ org_id: inv.org_id, user_id: userId, role: inv.role }, { onConflict: "org_id,user_id" });
  await admin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  await admin.from("audit_logs").insert({ org_id: inv.org_id, actor_id: userId, action: "invite.accept", resource: "invites", resource_id: inv.id, payload: { email: inv.email, role: inv.role }, hash: "pending" });
  return { email: inv.email };
}
