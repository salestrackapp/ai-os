import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { retomarProvision, reverterProvision, resendInvite, revokeInvite } from "./actions";
import { PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

const ST_BADGE: Record<string, string> = { pronto: "badge-teal", provisionando: "badge-gold", pendente: "badge-muted", falhou: "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" };
type Prov = { id: string; org_id: string | null; status: string; steps: { passo: string; status: string; erro?: string }[]; source: string; template_key: string | null; created_at: string };
type Inv = { id: string; org_id: string; email: string; role: string; token: string; accepted_at: string | null; expires_at: string };
type Chk = { org_id: string; items: { key: string; label: string; done: boolean }[]; completed_at: string | null };

export default async function OnboardingCentral() {
  const supabase = await createClient();
  const host = process.env.NEXT_PUBLIC_APP_HOST || process.env.NEXT_PUBLIC_SITE_URL || "";
  const base = host.startsWith("http") ? host : `https://${host}`;
  const [{ data: provs }, { data: invites }, { data: checklists }, { data: orgs }, { data: wonDeals }] = await Promise.all([
    supabase.from("tenant_provisioning").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("invites").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("onboarding_checklists").select("*"),
    supabase.from("organizations").select("id, name").eq("is_salestrack", false),
    supabase.from("deals").select("id, title").eq("stage", "cliente").order("created_at", { ascending: false }).limit(20),
  ]);
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const chkByOrg: Record<string, Chk> = Object.fromEntries(((checklists as Chk[]) ?? []).map((c) => [c.org_id, c]));

  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: "Onboarding" }]} className="mb-4" />
      <PageHeader eyebrow="Clientes · escala" title="Central de onboarding"
        subtitle="Do deal ganho ao cliente ativo — provisionamento sem banco manual."
        comoUsar={<HelpButton routeKey="/admin/clientes" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/onboarding/novo" className="btn-gold text-sm">+ Novo cliente</Link>
            {(wonDeals ?? []).length > 0 && <Link href={`/admin/onboarding/novo?deal=${wonDeals![0].id}`} className="btn-ghost text-sm">Provisionar do deal ganho</Link>}
          </div>
        } />

      {/* Provisionamentos */}
      <section className="mb-8">
        <h2 className="font-serif text-2xl font-semibold mb-3">Provisionamentos</h2>
        <div className="space-y-3">
          {((provs as Prov[]) ?? []).map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-cream">{p.org_id ? (orgName[p.org_id] ?? "org") : "—"}</span>
                  <span className={ST_BADGE[p.status] ?? "badge-muted"}>{p.status}</span>
                  <span className="text-[11px] text-muted2">{p.source}{p.template_key ? ` · ${p.template_key}` : ""} · {new Date(p.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex gap-2">
                  {p.status === "falhou" && <form action={retomarProvision.bind(null, p.id)}><button className="btn-gold text-xs">Retomar</button></form>}
                  {p.status !== "pronto" && <form action={reverterProvision.bind(null, p.id)}><button className="text-red-400/70 hover:text-red-400 text-xs">Reverter</button></form>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(p.steps ?? []).map((s, i) => <span key={i} className={s.status === "pronto" ? "badge-teal" : s.status === "falhou" ? "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" : "badge-muted"} title={s.erro ?? ""}>{s.status === "pronto" ? "✓" : s.status === "falhou" ? "✗" : "·"} {s.passo}</span>)}
              </div>
            </div>
          ))}
          {((provs as Prov[]) ?? []).length === 0 && <div className="card p-6"><p className="text-sm text-muted2">Nenhum provisionamento ainda.</p></div>}
        </div>
      </section>

      {/* Convites */}
      <section className="mb-8">
        <h2 className="font-serif text-2xl font-semibold mb-3">Convites</h2>
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">E-mail</th><th className="th">Cliente</th><th className="th">Papel</th><th className="th">Status</th><th className="th">Link</th><th className="th"></th></tr></thead>
            <tbody>
              {((invites as Inv[]) ?? []).map((i) => (
                <tr key={i.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                  <td className="td text-cream">{i.email}</td>
                  <td className="td text-muted text-xs">{orgName[i.org_id] ?? "—"}</td>
                  <td className="td text-xs text-muted2">{i.role}</td>
                  <td className="td"><span className={i.accepted_at ? "badge-teal" : new Date(i.expires_at) < new Date() ? "badge-muted" : "badge-gold"}>{i.accepted_at ? "aceito" : new Date(i.expires_at) < new Date() ? "expirado" : "pendente"}</span></td>
                  <td className="td"><span className="text-[11px] text-muted2 break-all">{base}/convite/{i.token.slice(0, 8)}…</span></td>
                  <td className="td text-right whitespace-nowrap">
                    {!i.accepted_at && <><form action={resendInvite.bind(null, i.id)} className="inline"><button className="text-muted2 hover:text-gold text-xs mr-2">reenviar</button></form>
                    <form action={revokeInvite.bind(null, i.id)} className="inline"><button className="text-red-400/70 hover:text-red-400 text-xs">revogar</button></form></>}
                  </td>
                </tr>
              ))}
              {((invites as Inv[]) ?? []).length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhum convite.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ativação */}
      <section>
        <h2 className="font-serif text-2xl font-semibold mb-3">Ativação por cliente</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {(orgs ?? []).map((o) => {
            const c = chkByOrg[o.id]; const done = (c?.items ?? []).filter((it) => it.done).length; const total = (c?.items ?? []).length;
            return (
              <div key={o.id} className="card p-5">
                <div className="flex items-center justify-between mb-2"><p className="font-serif text-base font-semibold">{o.name}</p><span className="text-xs text-muted2">{c ? `${done}/${total}` : "—"}</span></div>
                {c ? <div className="h-2 rounded-full bg-navy3 overflow-hidden"><div className="h-full bg-gold" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div> : <p className="text-xs text-muted2">Sem checklist.</p>}
                {c?.completed_at && <p className="text-[11px] text-teal-300 mt-1">✓ Ativação concluída</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
