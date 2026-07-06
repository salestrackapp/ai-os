import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ds";
import { resolvePortalOrg } from "@/lib/portal";
import { RoiView, } from "@/components/RoiView";
import type { RoiMetrics } from "@/lib/agents/roi";
import { getOrgFeatures } from "@/lib/plans/features";
import { Upsell } from "@/components/portal/Upsell";

export const dynamic = "force-dynamic";

type Roi = { id: string; periodo: string; metricas: RoiMetrics; narrativa: string | null };

function mesLabel(periodo: string) {
  const d = new Date(`${periodo}T00:00:00Z`);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function PortalRoiPage() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  if (!m!.adminView && !(await getOrgFeatures(orgId)).roi) return <Upsell feature="roi" />;
  const supabase = await createClient();
  // RLS: cliente só vê publicados da própria org
  const { data } = await supabase.from("roi_reports").select("*").eq("org_id", orgId).eq("publicado", true).order("periodo", { ascending: false });
  const list = (data as Roi[]) ?? [];

  return (
    <div>
      <PageHeader eyebrow="Seu retorno" title="ROI do Programa" />
      <p className="text-sm text-muted mb-6 max-w-2xl">A cada mês, um retrato do valor gerado: adoção do Playbook, sessões, entregáveis e a evolução do seu programa.</p>

      {list.length === 0 ? (
        <div className="card p-8"><p className="text-sm text-muted2">Seu primeiro relatório de ROI aparecerá aqui assim que o mês fechar.</p></div>
      ) : (
        <div className="space-y-6">
          {list.map((r) => (
            <div key={r.id} className="card p-6">
              <p className="font-serif text-xl font-semibold capitalize mb-4">{mesLabel(r.periodo)}</p>
              <RoiView metricas={r.metricas} narrativa={r.narrativa} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
