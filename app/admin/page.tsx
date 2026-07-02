import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const [{ count: catalogCount }, { count: reviewCount }, { data: deals }, { count: orgCount }] = await Promise.all([
    supabase.from("catalog_items").select("*", { count: "exact", head: true }),
    supabase.from("catalog_items").select("*", { count: "exact", head: true }).eq("needs_review", true),
    supabase.from("deals").select("stage"),
    supabase.from("organizations").select("*", { count: "exact", head: true }).eq("is_salestrack", false),
  ]);
  const byStage: Record<string, number> = {};
  (deals ?? []).forEach((d: { stage: string }) => { byStage[d.stage] = (byStage[d.stage] ?? 0) + 1; });

  const cards = [
    { label: "Itens no catálogo", value: catalogCount ?? 0, note: `${reviewCount ?? 0} com preço a revisar` },
    { label: "Deals no pipeline", value: (deals ?? []).length, note: Object.entries(byStage).map(([s, n]) => `${STAGE_LABELS[s] ?? s}: ${n}`).join(" · ") || "vazio" },
    { label: "Organizações clientes", value: orgCount ?? 0, note: "excluindo a org interna" },
  ];

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Fase 1 · Fundação</p>
      <h1 className="font-serif text-4xl font-semibold mb-8">Dashboard Executivo</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-6">
            <p className="label">{c.label}</p>
            <p className="font-serif text-5xl font-semibold text-gold">{c.value}</p>
            <p className="mt-2 text-xs text-muted">{c.note}</p>
          </div>
        ))}
      </div>
      <div className="card p-6 mt-5">
        <p className="label">Próximos módulos</p>
        <p className="text-sm text-muted">Fase 2 — Gerador de Propostas padrão ART MG · Portal de Aprovação · desligamento do HubSpot. Preencha os preços marcados no Catálogo antes de abrir a Fase 2.</p>
      </div>
    </div>
  );
}
