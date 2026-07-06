import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ds";
import { resolvePortalOrg } from "@/lib/portal";
import { KIND_LABELS, STATUS_LABELS, type DeliverableKind } from "@/lib/deliverables/types";
import { PortalDownloadButton } from "@/components/deliverables/PortalDownloadButton";

export const dynamic = "force-dynamic";

export default async function PortalEntregaveis() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  // RLS já restringe a org + status aprovado/entregue.
  const { data: list } = await supabase.from("studio_deliverables")
    .select("id, title, kind, status, format, delivered_at, created_at")
    .eq("org_id", orgId).in("status", ["aprovado", "entregue"]).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader eyebrow="Meu programa" title="Entregáveis" />
      <p className="text-sm text-muted mb-6">Documentos executivos do seu programa — relatórios de ROI, propostas e materiais, prontos para baixar.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {(list ?? []).map((d) => (
          <div key={d.id} className="card p-5 flex flex-col justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[.16em] text-gold mb-1">{KIND_LABELS[d.kind as DeliverableKind] ?? d.kind}</p>
              <p className="font-serif text-xl font-semibold">{d.title}</p>
              <p className="text-xs text-muted2 mt-1">{STATUS_LABELS[d.status]} · {String(d.format).toUpperCase()}{d.delivered_at ? ` · ${new Date(d.delivered_at).toLocaleDateString("pt-BR")}` : ""}</p>
            </div>
            <div><PortalDownloadButton id={d.id} /></div>
          </div>
        ))}
        {(list ?? []).length === 0 && <div className="card p-6 sm:col-span-2"><p className="text-sm text-muted2">Nenhum documento disponível ainda. Assim que a Salestrack publicar um entregável, ele aparece aqui.</p></div>}
      </div>
    </div>
  );
}
