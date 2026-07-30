import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  PROJECT_STATUS_LABELS, ASSET_TYPE_LABELS, SESSION_TYPE_LABELS, SESSION_STATUS_LABELS,
  type Project, type LibraryAsset, type Session, type SessionCredit, type SessionCatalog,
} from "@/lib/types";
import { setProgramStatus, uploadLibraryAsset, deleteLibraryAsset, viewPortalAs, grantSessionCredits, scheduleSession, closeSession } from "../actions";
import { createClientInvite } from "@/app/portal/equipe/actions";
import { Icon } from "@/components/ui/icons";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

type Step = { step: string; done: boolean; note?: string };

export default async function ProgramaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!p) notFound();
  const project = p as Project;
  const [{ data: org }, { data: assets }, { data: credits }, { data: sessions }, { data: catalog }] = await Promise.all([
    project.org_id ? supabase.from("organizations").select("id, name").eq("id", project.org_id).single() : Promise.resolve({ data: null }),
    project.org_id ? supabase.from("library_assets").select("*").eq("org_id", project.org_id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    project.org_id ? supabase.from("session_credits").select("*").eq("org_id", project.org_id) : Promise.resolve({ data: [] }),
    project.org_id ? supabase.from("sessions").select("*").eq("org_id", project.org_id).order("scheduled_at", { ascending: false, nullsFirst: false }).limit(20) : Promise.resolve({ data: [] }),
    supabase.from("session_catalog").select("*").order("titulo"),
  ]);
  const checklist = (project.kickoff_checklist as Step[] | null) ?? [];
  const creditList = (credits as SessionCredit[]) ?? [];
  const sessionList = (sessions as Session[]) ?? [];
  const catList = (catalog as SessionCatalog[]) ?? [];
  const typeOpts = Object.entries(SESSION_TYPE_LABELS);

  return (
    <ContentArea>
      <div>
        <div className="flex items-center gap-3 mb-6"><Link href="/admin/programas" className="text-muted2 hover:text-gold text-sm">← Programas</Link></div>
        <h1 className="font-serif text-4xl font-semibold mb-1">{project.name}</h1>
        <p className="text-sm text-muted mb-6">{org?.name}</p>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Biblioteca */}
            <div className="card p-6">
              <h2 className="font-serif text-xl font-semibold mb-4">Biblioteca do cliente</h2>
              {project.org_id && (
                <form action={uploadLibraryAsset.bind(null, project.org_id)} className="grid sm:grid-cols-2 gap-3 mb-5">
                  <input className="input sm:col-span-2" name="title" placeholder="Título do material" required />
                  <select className="input" name="type" defaultValue="documento">{Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input className="input" name="tags" placeholder="tags (vírgula)" />
                  <input className="block w-full text-sm text-muted file:btn-gold file:mr-3 file:border-0 sm:col-span-2" type="file" name="file" required />
                  <button className="btn-gold sm:col-span-2">Enviar material</button>
                </form>
              )}
              <div className="space-y-2">
                {(assets as LibraryAsset[] | null)?.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-navy3 border border-line rounded-lg px-3 py-2 text-sm">
                    <span className="text-cream">{a.title} <span className="text-muted2 text-xs">· {ASSET_TYPE_LABELS[a.type] ?? a.type}</span></span>
                    <form action={deleteLibraryAsset.bind(null, a.id)}><button className="text-muted2 hover:text-red-400 text-xs">excluir</button></form>
                  </div>
                ))}
                {(!assets || assets.length === 0) && <p className="text-sm text-muted2">Nenhum material enviado.</p>}
              </div>
            </div>

            {/* Convidar equipe do cliente */}
            {project.org_id && (
              <div className="card p-6">
                <h2 className="font-serif text-xl font-semibold mb-3">Convidar equipe do cliente</h2>
                <form action={createClientInvite.bind(null, project.org_id)} className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-52"><label className="label">E-mail</label><input className="input" name="email" type="email" required /></div>
                  <div className="w-40"><label className="label">Papel</label><select className="input" name="role" defaultValue="client_admin"><option value="client_admin">Administrador</option><option value="client_member">Membro</option></select></div>
                  <button className="btn-gold">Convidar</button>
                </form>
              </div>
            )}

            {/* Sessões & créditos */}
            {project.org_id && (
              <div className="card p-6">
                <h2 className="font-serif text-xl font-semibold mb-4">Sessões ao Vivo & créditos</h2>

                {/* Créditos */}
                <p className="label mb-2">Créditos</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {creditList.map((c) => (
                    <span key={c.id} className="badge-muted">{SESSION_TYPE_LABELS[c.type] ?? c.type}: {Math.max(0, c.total - (c.consumed ?? 0))}/{c.total}</span>
                  ))}
                  {creditList.length === 0 && <span className="text-sm text-muted2">Nenhum crédito.</span>}
                </div>
                <form action={grantSessionCredits.bind(null, project.org_id)} className="flex flex-wrap items-end gap-2 mb-6">
                  <div><label className="label">Tipo</label><select className="input" name="type" defaultValue="sessao_estrategica">{typeOpts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                  <div className="w-24"><label className="label">Total</label><input className="input" name="total" type="number" min={0} defaultValue={1} /></div>
                  <div><label className="label">Validade</label><input className="input" name="valid_until" type="date" /></div>
                  <button className="btn-ghost">Conceder</button>
                </form>

                {/* Agendar sessão */}
                <p className="label mb-2">Agendar sessão (manual)</p>
                <form action={scheduleSession.bind(null, project.org_id)} className="grid sm:grid-cols-2 gap-2 mb-6">
                  <select className="input" name="type" defaultValue="sessao_estrategica">{typeOpts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <select className="input" name="catalog_id" defaultValue="">
                    <option value="">— catálogo (opcional) —</option>
                    {catList.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                  </select>
                  <input className="input sm:col-span-2" name="title" placeholder="Título da sessão" required />
                  <input className="input" name="scheduled_at" type="datetime-local" />
                  <input className="input" name="meet_link" placeholder="Link da sala (Meet)" />
                  <button className="btn-gold sm:col-span-2">Agendar</button>
                </form>

                {/* Sessões existentes */}
                <p className="label mb-2">Sessões</p>
                <div className="space-y-2">
                  {sessionList.map((s) => (
                    <details key={s.id} className="bg-navy3 border border-line rounded-lg px-3 py-2">
                      <summary className="cursor-pointer list-none flex items-center justify-between text-sm">
                        <span className="text-cream">{s.title} <span className="text-muted2 text-xs">· {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString("pt-BR") : "sem data"}</span></span>
                        <span className={s.status === "realizada" ? "badge-teal" : "badge-muted"}>{SESSION_STATUS_LABELS[s.status] ?? s.status}</span>
                      </summary>
                      {s.status !== "realizada" && (
                        <form action={closeSession.bind(null, s.id)} className="mt-3 space-y-2">
                          <textarea className="input w-full text-sm" name="summary_md" rows={2} placeholder="Resumo da sessão (Read AI / manual)" />
                          <input className="input w-full text-sm" name="recording_url" placeholder="URL da gravação" />
                          <button className="btn-ghost text-xs">Marcar realizada (debita 1 crédito)</button>
                        </form>
                      )}
                      {s.status === "realizada" && s.summary_md && <p className="text-xs text-muted mt-2 whitespace-pre-wrap">{s.summary_md}</p>}
                    </details>
                  ))}
                  {sessionList.length === 0 && <p className="text-sm text-muted2">Nenhuma sessão registrada.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-xl font-semibold">Status</h3>
                <span className={project.status === "ativo" ? "badge-teal" : project.status === "onboarding" ? "badge-gold" : "badge-muted"}>{PROJECT_STATUS_LABELS[project.status]}</span>
              </div>
              {project.activated_at && <p className="text-xs text-muted2 mb-3">Ativado {new Date(project.activated_at).toLocaleDateString("pt-BR")} · {project.activated_by === "admin" ? "manual" : "primeiro acesso"}</p>}
              <div className="space-y-2">
                {project.status !== "ativo" && <form action={setProgramStatus.bind(null, id, "ativo")}><button className="btn-gold w-full justify-center">Ativar programa</button></form>}
                {project.status === "ativo" && <form action={setProgramStatus.bind(null, id, "pausado")}><button className="btn-ghost w-full justify-center">Pausar</button></form>}
                {project.status === "pausado" && <form action={setProgramStatus.bind(null, id, "ativo")}><button className="btn-gold w-full justify-center">Retomar</button></form>}
                {project.org_id && <form action={viewPortalAs.bind(null, project.org_id)}><button className="btn-ghost w-full justify-center"><Icon name="eye" size={14} /> Ver portal do cliente</button></form>}
              </div>
            </div>

            {checklist.length > 0 && (
              <div className="card p-6">
                <h3 className="font-serif text-lg font-semibold mb-3">Kickoff</h3>
                <ul className="space-y-2">
                  {checklist.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><span className={s.done ? "text-teal" : "text-red-400"}>{s.done ? "✓" : "✗"}</span><div><span className="text-cream">{s.step}</span>{s.note && <span className="text-muted2 text-xs"> — {s.note}</span>}</div></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </ContentArea>
  );
}
