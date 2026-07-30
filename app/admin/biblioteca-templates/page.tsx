import { createClient } from "@/lib/supabase/server";
import { publishAction, duplicateTemplate, toggleTemplate } from "./actions";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

type Tpl = { key: string; name: string; description: string | null; vertical_key: string | null; current_version: number | null; is_active: boolean; structure: Record<string, unknown> };
type Vert = { key: string; name: string; tone: string | null };
type Block = { key: string; name: string; category: string; vertical_key: string | null };
type Ver = { template_key: string; version: number; is_published: boolean; changelog: string | null; published_at: string | null };

export default async function BibliotecaTemplates() {
  const supabase = await createClient();
  const [{ data: verts }, { data: tpls }, { data: blocks }, { data: versions }] = await Promise.all([
    supabase.from("template_verticals").select("*").order("name"),
    supabase.from("program_templates").select("*").order("vertical_key"),
    supabase.from("template_blocks").select("*").order("category").order("name"),
    supabase.from("template_versions").select("template_key, version, is_published, changelog, published_at").order("version", { ascending: false }),
  ]);
  const vertName: Record<string, string> = Object.fromEntries(((verts as Vert[]) ?? []).map((v) => [v.key, v.name]));
  const blockList = (blocks as Block[]) ?? [];
  const versByTpl: Record<string, Ver[]> = {};
  for (const v of (versions as Ver[]) ?? []) (versByTpl[v.template_key] ??= []).push(v);
  const catOrder = ["frente", "agente", "entregavel", "marco", "biblioteca", "kpi"];

  return (
    <ContentArea>
      <div>
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Método", href: "/admin/metodo" }, { label: "Templates" }]} className="mb-4" />
        <PageHeader eyebrow="Método · autoria" title="Biblioteca de templates"
          subtitle="Blueprints por setor, montados de blocos reutilizáveis e versionados — alimentam o provisionamento."
          comoUsar={<HelpButton routeKey="/admin/metodo" />} />

        {/* Verticais + blueprints */}
        <section className="mb-8">
          <h2 className="font-serif text-2xl font-semibold mb-3">Blueprints por vertical</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {((tpls as Tpl[]) ?? []).map((t) => {
              const st = t.structure ?? {};
              const frentes = Array.isArray(st.frentes) ? (st.frentes as string[]) : [];
              const dels = Array.isArray(st.deliverables) ? (st.deliverables as unknown[]).length : 0;
              const tl = Array.isArray(st.timeline) ? (st.timeline as unknown[]).length : 0;
              const vs = versByTpl[t.key] ?? [];
              return (
                <div key={t.key} className="card p-5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-serif text-lg font-semibold">{t.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="badge-muted">{t.vertical_key ? vertName[t.vertical_key] ?? t.vertical_key : "—"}</span>
                      <span className={t.is_active ? "badge-teal" : "badge-muted"}>v{t.current_version ?? "—"}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted2 mb-2">{t.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">{frentes.map((f) => <span key={f} className="badge-muted">{f}</span>)}</div>
                  <p className="text-[13px] text-muted2">{dels} entregáveis · {tl} fases · {vs.length} versão(ões)</p>
                  <div className="mt-2 flex items-center gap-2">
                    <form action={toggleTemplate.bind(null, t.key, !t.is_active)}><button className="btn-ghost text-xs">{t.is_active ? "Desativar" : "Ativar"}</button></form>
                    <details className="inline"><summary className="cursor-pointer text-xs text-gold list-none">Duplicar</summary>
                      <form action={duplicateTemplate.bind(null, t.key)} className="mt-2 flex gap-1">
                        <input name="new_key" placeholder="nova_key" className="input text-xs w-28" required />
                        <input name="new_name" placeholder="Novo nome" className="input text-xs w-32" required />
                        <button className="btn-ghost text-xs">ok</button>
                      </form>
                    </details>
                  </div>
                  {vs.length > 0 && <div className="mt-2 pt-2 border-t border-line space-y-0.5">{vs.slice(0, 4).map((v) => <p key={v.version} className="text-[13px] text-muted2">v{v.version}{v.is_published ? " · publicada" : ""}{v.changelog ? ` — ${v.changelog}` : ""}</p>)}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Compor & publicar */}
        <section className="mb-8">
          <h2 className="font-serif text-2xl font-semibold mb-3">Compor & publicar versão</h2>
          <form action={publishAction} className="card p-6 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-52"><label className="label">Template</label>
                <select name="template_key" className="input w-full" required>{((tpls as Tpl[]) ?? []).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></div>
              <div className="flex-1 min-w-52"><label className="label">Changelog</label><input name="changelog" className="input w-full" placeholder="ex.: adiciona agente de social" /></div>
            </div>
            <p className="label">Blocos (a ordem de seleção compõe a structure)</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
              {catOrder.flatMap((cat) => blockList.filter((b) => b.category === cat)).map((b) => (
                <label key={b.key} className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" name="blocks" value={b.key} /> <span className="text-[11px] uppercase text-muted2 w-16">{b.category}</span> {b.name}{b.vertical_key ? ` · ${b.vertical_key}` : ""}
                </label>
              ))}
            </div>
            <button className="btn-gold text-sm">Compilar & publicar nova versão</button>
            <p className="text-[13px] text-muted2">Publicar cria a próxima versão, marca como publicada e espelha na structure — tenants já provisionados não mudam.</p>
          </form>
        </section>

        {/* Blocos */}
        <section>
          <h2 className="font-serif text-2xl font-semibold mb-3">Blocos ({blockList.length})</h2>
          <div className="flex flex-wrap gap-2">
            {blockList.map((b) => <span key={b.key} className="badge-muted" title={b.key}>{b.category} · {b.name}{b.vertical_key ? ` (${b.vertical_key})` : ""}</span>)}
          </div>
        </section>
      </div>
    </ContentArea>
  );
}
