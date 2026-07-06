import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ds";
import { emailMap } from "@/lib/supabase/admin";
import { resolvePortalOrg } from "@/lib/portal";
import { CLIENT_ROLE_LABELS } from "@/lib/types";
import { createClientInvite, removeClientMember, resendInvite } from "./actions";

export const dynamic = "force-dynamic";

export default async function PortalEquipe() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const isAdmin = m!.adminView || m!.role === "client_admin";
  const supabase = await createClient();
  const { data: mems } = await supabase.from("memberships").select("user_id, role, created_at").eq("org_id", orgId).order("created_at");
  const emails = await emailMap((mems ?? []).map((x: { user_id: string }) => x.user_id));
  const { data: invites } = isAdmin ? await supabase.from("invites").select("*").eq("org_id", orgId).is("accepted_at", null).order("created_at", { ascending: false }) : { data: [] };

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Sua equipe" title="Equipe" />

      {isAdmin && (
        <form action={createClientInvite.bind(null, orgId)} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-52"><label className="label">Convidar por e-mail</label><input className="input" name="email" type="email" placeholder="colega@empresa.com" required /></div>
          <div className="w-44"><label className="label">Papel</label><select className="input" name="role" defaultValue="client_member"><option value="client_member">Membro</option><option value="client_admin">Administrador</option></select></div>
          <button className="btn-gold">Enviar convite</button>
        </form>
      )}

      <div className="card overflow-x-auto mb-6">
        <table className="w-full">
          <thead><tr><th className="th">Membro</th><th className="th">Papel</th><th className="th">Desde</th><th className="th"></th></tr></thead>
          <tbody>
            {(mems ?? []).map((x: { user_id: string; role: string; created_at: string }) => (
              <tr key={x.user_id} className="hover:bg-navy3/50">
                <td className="td text-cream">{emails[x.user_id] ?? x.user_id}{x.user_id === m!.userId && <span className="text-xs text-gold"> · você</span>}</td>
                <td className="td text-muted">{CLIENT_ROLE_LABELS[x.role] ?? x.role}</td>
                <td className="td text-xs text-muted2">{new Date(x.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="td text-right">{isAdmin && x.user_id !== m!.userId && <form action={removeClientMember.bind(null, x.user_id, orgId)}><button className="text-muted2 hover:text-red-400 text-xs">remover</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (invites ?? []).length > 0 && (
        <div className="card p-4">
          <p className="label mb-3">Convites pendentes</p>
          <div className="space-y-2">
            {(invites ?? []).map((iv: { id: string; email: string; role: string; expires_at: string }) => (
              <div key={iv.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">{iv.email} · {CLIENT_ROLE_LABELS[iv.role] ?? iv.role} · expira {new Date(iv.expires_at).toLocaleDateString("pt-BR")}</span>
                <form action={resendInvite.bind(null, iv.id)}><button className="text-gold text-xs hover:underline">reenviar</button></form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
