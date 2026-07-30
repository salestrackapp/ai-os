import { createServiceClient } from "@/lib/supabase/service";
import { AcceptInvite } from "@/components/portal/AcceptInvite";

export const dynamic = "force-dynamic";

function Invalido({ msg }: { msg: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-navy text-cream">
      <div className="card p-10 text-center max-w-md">
        <p className="text-[13px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-3xl font-semibold mb-2">Convite indisponível</h1>
        <p className="text-sm text-muted">{msg}</p>
      </div>
    </main>
  );
}

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data: inv } = await sb.from("invites").select("org_id, email, role, expires_at, accepted_at").eq("token", token).single();
  if (!inv) return <Invalido msg="Este convite é inválido ou foi revogado." />;
  if (inv.accepted_at) return <Invalido msg="Este convite já foi utilizado. Faça login normalmente." />;
  if (new Date(inv.expires_at) < new Date()) return <Invalido msg="Este convite expirou. Peça um novo ao administrador." />;

  // não revela dados da org além do nome + quem convidou
  const { data: org } = await sb.from("organizations").select("name").eq("id", inv.org_id).single();
  let inviterEmail: string | null = null;
  const { data: invRow } = await sb.from("invites").select("invited_by").eq("token", token).single();
  if (invRow?.invited_by) { const { data: u } = await sb.auth.admin.getUserById(invRow.invited_by); inviterEmail = u?.user?.email ?? null; }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-navy text-cream">
      <div className="card w-full max-w-md p-9">
        <p className="text-[13px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-3xl font-semibold mb-1">Bem-vindo(a)</h1>
        <p className="text-sm text-muted mb-6">Você foi convidado a acessar o portal de <b className="text-cream">{org?.name ?? "seu programa"}</b>{inviterEmail ? ` por ${inviterEmail}` : ""}. Crie sua senha para entrar.</p>
        <AcceptInvite token={token} email={inv.email} />
      </div>
    </main>
  );
}
