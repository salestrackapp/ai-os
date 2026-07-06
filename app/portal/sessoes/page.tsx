import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ds";
import { resolvePortalOrg } from "@/lib/portal";
import {
  SESSION_TYPE_LABELS, SESSION_STATUS_LABELS, MARCA_LABELS,
  type Session, type SessionCredit, type SessionCatalog,
} from "@/lib/types";
import { getOrgFeatures } from "@/lib/plans/features";
import { Upsell } from "@/components/portal/Upsell";

export const dynamic = "force-dynamic";

function fmt(iso: string | null) { return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" }) : "—"; }

export default async function SessoesPage() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  if (!m!.adminView && !(await getOrgFeatures(orgId)).sessoes) return <Upsell feature="sessoes" />;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: credits }, { data: upcoming }, { data: past }, { data: catalog }] = await Promise.all([
    supabase.from("session_credits").select("*").eq("org_id", orgId),
    supabase.from("sessions").select("*").eq("org_id", orgId).eq("status", "agendada").gte("scheduled_at", nowIso).order("scheduled_at"),
    supabase.from("sessions").select("*").eq("org_id", orgId).in("status", ["realizada", "no_show", "cancelada"]).order("scheduled_at", { ascending: false }).limit(20),
    supabase.from("session_catalog").select("*").eq("published", true).order("marca").order("titulo"),
  ]);
  const creditList = (credits as SessionCredit[]) ?? [];
  const upList = (upcoming as Session[]) ?? [];
  const pastList = (past as Session[]) ?? [];
  const catList = (catalog as SessionCatalog[]) ?? [];
  const totalSaldo = creditList.reduce((s, c) => s + Math.max(0, c.total - (c.consumed ?? 0)), 0);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader eyebrow="Entrega ao vivo" title="Sessões ao Vivo" />
        <p className="text-sm text-muted mt-2 max-w-2xl">Mentorias, workshops e formações da Salestrack. Após cada sessão, o resumo e a gravação ficam disponíveis aqui.</p>
      </div>

      {/* Saldo de créditos */}
      <div className="card p-6">
        <div className="flex items-baseline justify-between mb-4">
          <p className="label">Saldo de sessões</p>
          <span className="text-xs text-muted2 font-mono">{totalSaldo} disponíveis</span>
        </div>
        {creditList.length === 0 ? (
          <p className="text-sm text-muted2">Nenhum crédito de sessão no seu plano atual.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {creditList.map((c) => {
              const saldo = Math.max(0, c.total - (c.consumed ?? 0));
              return (
                <div key={c.id} className="bg-navy3 border border-line rounded-lg p-4">
                  <p className="text-sm text-cream">{SESSION_TYPE_LABELS[c.type] ?? c.type}</p>
                  <p className="font-serif text-2xl font-semibold text-gold mt-1">{saldo}<span className="text-sm text-muted2 font-sans"> / {c.total}</span></p>
                  {c.valid_until && <p className="text-[11px] text-muted2 mt-1">válido até {new Date(c.valid_until).toLocaleDateString("pt-BR")}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Próximas */}
      <section>
        <p className="label mb-3">Próximas sessões</p>
        {upList.length === 0 ? (
          <div className="card p-6"><p className="text-sm text-muted2">Nenhuma sessão agendada. Fale com seu ponto focal na Salestrack para marcar.</p></div>
        ) : (
          <div className="space-y-3">
            {upList.map((s) => (
              <div key={s.id} className="card p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-serif text-lg font-semibold">{s.title}</p>
                    <span className="badge-gold">{SESSION_STATUS_LABELS[s.status] ?? s.status}</span>
                  </div>
                  <p className="text-xs text-muted2 mt-0.5">{SESSION_TYPE_LABELS[s.type] ?? s.type} · {fmt(s.scheduled_at)}</p>
                </div>
                {s.meet_link && <a href={s.meet_link} target="_blank" className="btn-gold text-sm">Entrar na sala ↗</a>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Realizadas */}
      <section>
        <p className="label mb-3">Sessões realizadas</p>
        {pastList.length === 0 ? (
          <div className="card p-6"><p className="text-sm text-muted2">Ainda não há sessões realizadas.</p></div>
        ) : (
          <div className="space-y-3">
            {pastList.map((s) => {
              const items = Array.isArray(s.action_items) ? (s.action_items as string[]) : [];
              return (
                <details key={s.id} className="card p-5 group">
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <div>
                      <p className="font-serif text-lg font-semibold">{s.title}</p>
                      <p className="text-xs text-muted2 mt-0.5">{fmt(s.scheduled_at)}</p>
                    </div>
                    <span className={s.status === "realizada" ? "badge-teal" : "badge-muted"}>{SESSION_STATUS_LABELS[s.status] ?? s.status}</span>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-line space-y-3">
                    {s.summary_md ? (
                      <div><p className="label mb-1">Resumo</p><p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{s.summary_md}</p></div>
                    ) : <p className="text-sm text-muted2">Resumo ainda não disponível.</p>}
                    {items.length > 0 && (
                      <div><p className="label mb-1">Próximos passos</p><ul className="list-disc pl-5 space-y-1">{items.map((it, i) => <li key={i} className="text-sm text-muted">{it}</li>)}</ul></div>
                    )}
                    {s.recording_url && <a href={s.recording_url} target="_blank" className="text-gold text-sm hover:underline">▶ Assistir gravação ↗</a>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      {/* Catálogo disponível */}
      {catList.length > 0 && (
        <section>
          <p className="label mb-3">Modalidades disponíveis</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {catList.map((c) => (
              <div key={c.id} className="card p-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-serif text-base font-semibold">{c.titulo}</p>
                  <span className="text-[10px] uppercase tracking-[.14em] text-muted2">{MARCA_LABELS[c.marca] ?? c.marca}</span>
                </div>
                {c.descricao && <p className="text-sm text-muted mt-1">{c.descricao}</p>}
                {c.calendly_url
                  ? <a href={c.calendly_url} target="_blank" className="btn-ghost text-xs mt-3 inline-flex">Agendar ↗</a>
                  : <p className="text-[11px] text-muted2 mt-3">Agendamento via seu ponto focal.</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
