"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { MEMBERSHIP_ROLES } from "@/lib/types";
import { exigirAdmin } from "@/lib/auth";

async function salestrackOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id").eq("slug", "salestrack").single();
  return data?.id ?? null;
}
function validRole(r: string) { return Object.keys(MEMBERSHIP_ROLES).includes(r); }

export async function inviteMember(formData: FormData) {
  await exigirAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "colaborador");
  if (!email || !validRole(role)) throw new Error("E-mail e papel válidos são obrigatórios.");
  const orgId = await salestrackOrgId();
  if (!orgId) throw new Error("Org Salestrack não encontrada.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  let userId = data?.user?.id;
  if (error) {
    // já existe: localiza o usuário
    if (/registered|already|exists/i.test(error.message)) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    }
    if (!userId) throw new Error(error.message);
  }
  const { error: memErr } = await admin.from("memberships")
    .upsert({ org_id: orgId, user_id: userId, role }, { onConflict: "org_id,user_id" });
  if (memErr) throw new Error(memErr.message);
  await audit("team.invite", "memberships", userId, { email, role }, orgId);
  revalidatePath("/admin/configuracoes/equipe");
}

export async function changeRole(userId: string, role: string) {
  await exigirAdmin();
  if (!validRole(role)) return;
  const orgId = await salestrackOrgId();
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  await audit("team.role_change", "memberships", userId, { role }, orgId ?? undefined);
  revalidatePath("/admin/configuracoes/equipe");
}

export async function removeMember(userId: string) {
  await exigirAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === userId) throw new Error("Você não pode remover a si mesmo.");
  const orgId = await salestrackOrgId();
  const { error } = await supabase.from("memberships").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  await audit("team.remove", "memberships", userId, null, orgId ?? undefined);
  revalidatePath("/admin/configuracoes/equipe");
}
