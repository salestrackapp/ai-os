import type { RoiMetrics } from "@/lib/agents/roi";

/** Render read-only das métricas de ROI + narrativa. Usado no admin e no portal. */
export function RoiView({ metricas, narrativa }: { metricas: RoiMetrics; narrativa: string | null }) {
  const m = metricas;
  const cards = [
    { label: "Receitas concluídas", value: m?.playbook?.concluidas_mes ?? 0, note: `${m?.playbook?.usuarios_ativos ?? 0} pessoa(s) ativa(s)` },
    { label: "Sessões realizadas", value: m?.sessoes?.realizadas_mes ?? 0, note: `${m?.sessoes?.creditos_saldo ?? 0} créditos disponíveis` },
    { label: "Entregáveis", value: `${m?.entregaveis?.concluidos ?? 0}/${m?.entregaveis?.total ?? 0}`, note: "concluídos" },
    { label: "Progresso do programa", value: `${m?.programa?.progresso_pct ?? 0}%`, note: `fase ${m?.programa?.fase ?? "—"}` },
  ];
  const trilhas = Object.entries(m?.playbook?.por_trilha ?? {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-navy3 border border-line rounded-lg p-4">
            <p className="label">{c.label}</p>
            <p className="font-serif text-2xl font-semibold text-gold mt-1">{c.value}</p>
            <p className="text-[11px] text-muted2 mt-1">{c.note}</p>
          </div>
        ))}
      </div>
      {trilhas.length > 0 && (
        <p className="text-xs text-muted2">Por trilha: {trilhas.map(([t, n]) => `${t} (${n})`).join(" · ")}</p>
      )}
      {narrativa && <div className="bg-navy2 border border-line rounded-lg p-5"><p className="text-sm text-cream whitespace-pre-wrap leading-relaxed">{narrativa}</p></div>}
    </div>
  );
}
