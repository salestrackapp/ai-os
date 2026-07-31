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

  /**
   * Um cliente não convida gente da Salestrack para dentro da própria conta.
   *
   * Segunda camada da correção do aceite: mesmo sem poder trocar senha alheia, deixar um
   * `client_admin` criar convites para o nosso time abre porta para engenharia social — um convite
   * legítimo, vindo do sistema, pedindo para alguém nosso "criar a senha". Quem precisa de acesso a
   * uma org cliente é a equipe Salestrack por `salestrack_admin`, que já enxerga tudo.
   */
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin && /@(salestrack\.com\.br|andrekachan\.com\.br)$/i.test(email)) {
    throw new Error("Endereços da Salestrack não podem ser convidados por aqui — a equipe já tem acesso ao programa.");
  }

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

/**
 * Aceite público do convite.
 *
 * ── A tomada de conta que existia aqui ────────────────────────────────────────────────────────
 * Quando o e-mail convidado JÁ tinha conta, esta função chamava `updateUserById({ password })` —
 * ou seja, aceitar um convite REDEFINIA a senha de uma conta existente, para a senha digitada por
 * quem estivesse com o link na mão.
 *
 * O caminho de ataque era curto: `createClientInvite` aceita qualquer e-mail e qualquer
 * `client_admin` de qualquer organização cliente pode criar um convite. Bastava convidar o e-mail
 * de um admin da Salestrack, abrir o próprio link e escolher a senha dele. Cliente vira admin do
 * sistema inteiro.
 *
 * O fluxo nunca tinha sido usado (zero convites em produção), então o defeito nunca se manifestou.
 *
 * ── A regra ───────────────────────────────────────────────────────────────────────────────────
 * Convite concede ACESSO A UMA ORGANIZAÇÃO. Não concede posse de uma identidade. Quem já tem conta
 * ganha o vínculo e entra com a senha que já usa; quem não tem, cria a dele. Em nenhum caminho uma
 * credencial existente é tocada — trocar senha só se faz por "esqueci minha senha", que passa pela
 * caixa de e-mail da própria pessoa.
 */
export async function acceptInvite(token: string, password: string): Promise<{ email: string; jaTinhaConta: boolean }> {
  const admin = createServiceClient();
  const { data: inv } = await admin.from("invites").select("*").eq("token", token).single();
  if (!inv) throw new Error("Convite inválido.");
  if (inv.accepted_at) throw new Error("Convite já utilizado.");
  if (new Date(inv.expires_at) < new Date()) throw new Error("Convite expirado.");
  if (!password || password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres.");

  let userId: string | undefined;
  let jaTinhaConta = false;

  const created = await admin.auth.admin.createUser({ email: inv.email, password, email_confirm: true });
  if (created.error) {
    if (!/registered|already|exists/i.test(created.error.message)) throw new Error(created.error.message);

    /**
     * Já existe conta com este e-mail. O vínculo é criado; a senha NÃO é tocada.
     *
     * A busca é paginada porque `listUsers` devolve uma página por vez: parar na primeira faria a
     * função dizer "não encontrei" para o usuário 201 e cair no erro genérico — um convite que
     * falha sem explicação a partir de um certo tamanho da base.
     */
    jaTinhaConta = true;
    const alvo = inv.email.toLowerCase();
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (!list?.users.length) break;
      userId = list.users.find((u) => u.email?.toLowerCase() === alvo)?.id;
      if (list.users.length < 200) break;
    }
    if (!userId) throw new Error("Já existe uma conta com este e-mail, mas não consegui localizá-la. Fale com a Salestrack.");
  } else {
    userId = created.data.user.id;
  }

  await admin.from("memberships").upsert({ org_id: inv.org_id, user_id: userId, role: inv.role }, { onConflict: "org_id,user_id" });
  await admin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  await admin.from("audit_logs").insert({ org_id: inv.org_id, actor_id: userId, action: "invite.accept", resource: "invites", resource_id: inv.id, payload: { email: inv.email, role: inv.role, conta_preexistente: jaTinhaConta }, hash: "pending" });
  return { email: inv.email, jaTinhaConta };
}
