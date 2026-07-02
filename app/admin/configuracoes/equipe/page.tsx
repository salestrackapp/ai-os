import { createClient } from "@/lib/supabase/server";
import { usersInfo } from "@/lib/supabase/admin";
import { ConfigNav } from "@/components/config/ConfigNav";
import { TeamManager } from "@/components/config/TeamManager";
import { MEMBERSHIP_ROLES } from "@/lib/types";
import { inviteMember } from "./actions";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", "salestrack").single();
  const { data: mems } = await supabase.from("memberships")
    .select("user_id, role, created_at").eq("org_id", org?.id ?? "").order("created_at");
  const info = await usersInfo();

  const members = (mems ?? []).map((m: { user_id: string; role: string; created_at: string }) => ({
    userId: m.user_id, role: m.role, created_at: m.created_at,
    email: info[m.user_id]?.email ?? null, mfa: info[m.user_id]?.mfa ?? false,
    self: m.user_id === user?.id,
  }));

  return (
    <div className="max-w-3xl">
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">A Fortaleza · Equipe</p>
      <h1 className="font-serif text-4xl font-semibold mb-6">Equipe Salestrack</h1>
      <ConfigNav />

      <form action={inviteMember} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52"><label className="label">Convidar por e-mail</label>
          <input className="input" name="email" type="email" placeholder="pessoa@salestrack.com.br" required /></div>
        <div className="w-52"><label className="label">Papel</label>
          <select className="input" name="role" defaultValue="colaborador">
            {Object.entries(MEMBERSHIP_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <button className="btn-gold">Enviar convite</button>
      </form>

      <TeamManager members={members} />
      <p className="text-xs text-muted2 mt-3">O convite envia um e-mail de definição de senha (Supabase Auth) e já vincula o papel escolhido. Tudo auditado.</p>
    </div>
  );
}
