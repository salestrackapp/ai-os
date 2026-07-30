import { createClient } from "@/lib/supabase/server";
import { anthropicConfigured } from "@/lib/agents/runner";
import { periodoISO, type RoiMetrics } from "@/lib/agents/roi";
import { RoiView } from "@/components/RoiView";
import { generateRoiForOrg, generateRoiAllActive, saveRoiNarrativa, publishRoi } from "./actions";
import { generateAction } from "@/app/admin/entregaveis/actions";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Roi = { id: string; org_id: string; periodo: string; metricas: RoiMetrics; narrativa: string | null; publicado: boolean };

export default async function AdminRoiPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const periodo = sp.periodo && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : periodoISO(now).slice(0, 7);
  const supabase = await createClient();
  const [{ data: reports }, { data: activeProjs }] = await Promise.all([
    supabase.from("roi_reports").select("*").eq("periodo", `${periodo}-01`).order("created_at", { ascending: false }),
    supabase.from("projects").select("org_id, name").eq("status", "ativo").not("org_id", "is", null),
  ]);
  const list = (reports as Roi[]) ?? [];
  const orgIds = [...new Set([...(activeProjs ?? []).map((p) => p.org_id), ...list.map((r) => r.org_id)])] as string[];
  const { data: orgs } = orgIds.length ? await supabase.from("organizations").select("id, name").in("id", orgIds) : { data: [] as { id: string; name: string }[] };
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const semRelatorio = (activeProjs ?? []).filter((p) => !list.some((r) => r.org_id === p.org_id));
  const pendentes = list.filter((r) => !r.publicado).length;

  return (
    <ContentArea>
      <div>
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: "ROI / Sucesso" }]} className="mb-4" />
        <PageHeader eyebrow="Clientes · sucesso" title="Relatórios de ROI"
          subtitle={`Agente de Sucesso — narrativa mensal a partir de métricas do AI OS.${pendentes > 0 ? ` ${pendentes} pendente(s) de publicação.` : ""}`}
          comoUsar={<HelpButton routeKey="/admin/roi" />}
          actions={
            <div className="flex items-end gap-2">
              <form className="flex items-end gap-2"><label className="label">Mês<input type="month" name="periodo" defaultValue={periodo} className="input block mt-1" /></label><button className="btn-ghost">Ver</button></form>
              <form action={generateRoiAllActive.bind(null, periodo)}><button className="btn-gold whitespace-nowrap">Gerar todos ativos</button></form>
            </div>
          } />

        {!anthropicConfigured() && <div className="card p-3 mb-4 border-goldline bg-[rgba(0, 122, 148,.06)]"><p className="text-sm text-gold">Sem ANTHROPIC_API_KEY: as métricas são calculadas, mas a narrativa fica vazia (você pode escrevê-la manualmente).</p></div>}

        {semRelatorio.length > 0 && (
          <div className="card p-4 mb-5">
            <p className="label mb-2">Clientes ativos sem relatório em {periodo}</p>
            <div className="flex flex-wrap gap-2">
              {semRelatorio.map((p) => (
                <form key={p.org_id} action={generateRoiForOrg.bind(null, p.org_id!, periodo)}><button className="badge-muted hover:!text-gold hover:!border-goldline">+ {p.name}</button></form>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {list.map((r) => (
            <div key={r.id} className="card p-6">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-semibold">{orgName[r.org_id] ?? "—"}</h2>
                  <span className={r.publicado ? "badge-teal" : "badge-muted"}>{r.publicado ? "Publicado" : "Rascunho"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={generateRoiForOrg.bind(null, r.org_id, periodo)}><button className="btn-ghost text-xs">Regerar</button></form>
                  {r.publicado && <form action={generateAction.bind(null, "roi", r.id)}><button className="btn-ghost text-xs">Gerar relatório executivo →</button></form>}
                  <form action={publishRoi.bind(null, r.id, !r.publicado)}><button className="btn-gold text-xs">{r.publicado ? "Despublicar" : "Publicar"}</button></form>
                </div>
              </div>
              <RoiView metricas={r.metricas} narrativa={null} />
              <form action={saveRoiNarrativa.bind(null, r.id)} className="mt-4">
                <label className="label mb-1 block">Narrativa (revise antes de publicar)</label>
                <textarea name="narrativa" defaultValue={r.narrativa ?? ""} rows={6} className="input w-full text-sm" placeholder="Narrativa do Agente de Sucesso…" />
                <button className="btn-ghost text-xs mt-2">Salvar narrativa</button>
              </form>
            </div>
          ))}
          {list.length === 0 && <div className="card p-8"><p className="text-sm text-muted2">Nenhum relatório gerado para {periodo}. Use "Gerar todos ativos" ou gere por cliente acima.</p></div>}
        </div>
      </div>
    </ContentArea>
  );
}
