"use client";
import { useState, useMemo, useTransition } from "react";
import { verifyChain } from "@/app/admin/configuracoes/auditoria/actions";

type Row = {
  id: number; action: string; resource: string; resource_id: string | null;
  actor: string; ip: string | null; created_at: string; payload: unknown;
};
const PAGE = 20;

export function AuditView({ rows }: { rows: Row[] }) {
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [days, setDays] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Row | null>(null);
  const [result, setResult] = useState<{ ok: boolean; brokenId: number | null; total: number } | null>(null);
  const [pending, start] = useTransition();

  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);
  const resources = useMemo(() => [...new Set(rows.map((r) => r.resource))].sort(), [rows]);

  const filtered = useMemo(() => {
    const cutoff = days ? Date.now() - Number(days) * 86_400_000 : 0;
    return rows.filter((r) =>
      (!action || r.action === action) && (!resource || r.resource === resource) &&
      (!cutoff || new Date(r.created_at).getTime() >= cutoff));
  }, [rows, action, resource, days]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div>
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52"><label className="label">Ação</label>
          <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
            <option value="">Todas</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select></div>
        <div className="w-44"><label className="label">Recurso</label>
          <select className="input" value={resource} onChange={(e) => { setResource(e.target.value); setPage(0); }}>
            <option value="">Todos</option>{resources.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></div>
        <div className="w-40"><label className="label">Período</label>
          <select className="input" value={days} onChange={(e) => { setDays(e.target.value); setPage(0); }}>
            <option value="">Tudo</option><option value="1">24 horas</option><option value="7">7 dias</option><option value="30">30 dias</option>
          </select></div>
        <button className="btn-gold ml-auto" disabled={pending} onClick={() => start(async () => setResult(await verifyChain()))}>
          {pending ? "Verificando…" : "Verificar integridade da cadeia"}
        </button>
      </div>

      {result && (
        <div className={`card p-4 mb-4 ${result.ok ? "border-[rgba(63,169,142,.4)]" : "border-red-500/50"}`}>
          {result.ok
            ? <p className="text-sm text-teal">✓ Cadeia íntegra — {result.total} registros encadeados corretamente (prev_hash → hash).</p>
            : <p className="text-sm text-red-400">✗ Quebra detectada no registro #{result.brokenId}. A cadeia foi adulterada, reordenada ou teve registros removidos.</p>}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Data</th><th className="th">Autor</th><th className="th">Ação</th>
            <th className="th">Recurso</th><th className="th">IP</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} className="hover:bg-navy3/50">
                <td className="td text-xs text-muted2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="td text-muted">{r.actor}</td>
                <td className="td"><span className="badge-muted">{r.action}</span></td>
                <td className="td text-muted">{r.resource}{r.resource_id ? <span className="text-muted2 text-xs"> · {r.resource_id.slice(0, 8)}</span> : ""}</td>
                <td className="td font-mono text-xs text-muted2">{r.ip ?? "—"}</td>
                <td className="td text-right"><button className="text-gold text-sm hover:underline" onClick={() => setDetail(r)}>Ver</button></td>
              </tr>
            ))}
            {slice.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhum registro para os filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm text-muted2">
        <span>{filtered.length} registros</span>
        <div className="flex gap-2 items-center">
          <button className="btn-ghost text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← anterior</button>
          <span>{page + 1} / {pages}</span>
          <button className="btn-ghost text-xs" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>próxima →</button>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg h-full bg-navy2 border-l border-line p-8 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-2xl font-semibold">Registro #{detail.id}</h3>
              <button className="text-muted2 hover:text-cream" onClick={() => setDetail(null)}>×</button>
            </div>
            <dl className="space-y-2 text-sm mb-5">
              <div className="flex gap-3"><dt className="text-muted2 w-24">Ação</dt><dd className="text-cream">{detail.action}</dd></div>
              <div className="flex gap-3"><dt className="text-muted2 w-24">Recurso</dt><dd className="text-cream">{detail.resource} {detail.resource_id}</dd></div>
              <div className="flex gap-3"><dt className="text-muted2 w-24">Autor</dt><dd className="text-cream">{detail.actor}</dd></div>
              <div className="flex gap-3"><dt className="text-muted2 w-24">Data</dt><dd className="text-cream">{new Date(detail.created_at).toLocaleString("pt-BR")}</dd></div>
            </dl>
            <p className="label mb-2">Payload</p>
            <pre className="bg-navy3 border border-line rounded-lg p-4 text-xs text-muted overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detail.payload, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
