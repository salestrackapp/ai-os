"use client";
/** Listagem do CRUD kit — busca, ordenação, paginação, ações por linha (gated por permissão), empty que ensina. */
import { useMemo, useState } from "react";
import { EmptyState, Input, Badge } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { getResource } from "@/lib/crud/registry";
import type { CrudOp } from "@/lib/crud/types";

const PAGE = 25;

export function DataTable({ resourceName, rows, can, onNew, onEdit, onDuplicate, onDelete, extraRowActions }: {
  resourceName: string; rows: Record<string, unknown>[]; can: Record<CrudOp, boolean>;
  onNew?: () => void; onEdit?: (row: Record<string, unknown>) => void;
  onDuplicate?: (row: Record<string, unknown>) => void; onDelete?: (row: Record<string, unknown>) => void;
  extraRowActions?: (row: Record<string, unknown>) => React.ReactNode;
}) {
  const def = getResource(resourceName);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(def.orderBy?.column ?? null);
  const [asc, setAsc] = useState(def.orderBy?.ascending ?? true);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const s = q.toLowerCase();
      const keys = def.searchKeys ?? def.columns.map((c) => c.key);
      r = r.filter((row) => keys.some((k) => String(row[k] ?? "").toLowerCase().includes(s)));
    }
    if (sortKey) r = [...r].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return asc ? cmp : -cmp;
    });
    return r;
  }, [rows, q, sortKey, asc, def]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const anyRowAction = can.update || can.duplicate || can.delete || !!extraRowActions;

  const toggleSort = (k: string) => { if (sortKey === k) setAsc((v) => !v); else { setSortKey(k); setAsc(true); } };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-4)]"><Icon name="target" size={15} /></span>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={`Buscar ${def.plural}…`} className="!pl-9" />
        </div>
        {can.create && onNew && (
          <button onClick={onNew} className="ds-focus inline-flex h-10 shrink-0 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand transition-colors hover:bg-brand-hover">
            <Icon name="userPlus" size={15} /> Novo {def.singular}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Icon name="layers" size={22} />}
          title={q ? `Nenhum resultado para "${q}"` : `Nenhum ${def.singular} ainda`}
          description={q ? "Tente outro termo de busca." : `Aqui ficam os seus ${def.plural}. Crie o primeiro para começar.`}
          action={!q && can.create && onNew ? (
            <button onClick={onNew} className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="userPlus" size={15} /> Criar {def.singular}</button>
          ) : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-ds-card border border-hairline bg-[var(--bg-1)] shadow-ds-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline">
                {def.columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 font-jbmono text-[11px] font-normal uppercase tracking-[0.08em] text-[color:var(--fg-3)] ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                    <button onClick={() => toggleSort(c.key)} className="ds-focus inline-flex items-center gap-1 hover:text-[color:var(--fg-1)]">
                      {c.header}{sortKey === c.key && <span>{asc ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                ))}
                {anyRowAction && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {view.map((row) => (
                <tr key={String(row.id)} className="border-b border-hairline last:border-0 transition-colors hover:bg-[var(--bg-2)]">
                  {def.columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 text-sm text-[color:var(--fg-2)] ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"} ${c.mono ? "font-jbmono tabular-nums text-[color:var(--fg-1)]" : ""}`}>
                      {c.render ? c.render(row) : typeof row[c.key] === "boolean" ? (row[c.key] ? <Badge tone="success">sim</Badge> : <Badge>não</Badge>) : String(row[c.key] ?? "")}
                    </td>
                  ))}
                  {anyRowAction && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {extraRowActions?.(row)}
                        {can.update && onEdit && <button onClick={() => onEdit(row)} title="Editar" className="ds-focus rounded-[8px] p-1.5 text-[color:var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[color:var(--brand)]"><Icon name="pen" size={15} /></button>}
                        {can.duplicate && onDuplicate && <button onClick={() => onDuplicate(row)} title="Duplicar" className="ds-focus rounded-[8px] p-1.5 text-[color:var(--fg-3)] hover:bg-[var(--bg-2)] hover:text-[color:var(--brand)]"><Icon name="layers" size={15} /></button>}
                        {can.delete && onDelete && <button onClick={() => onDelete(row)} title="Excluir" className="ds-focus rounded-[8px] p-1.5 text-[color:var(--fg-3)] hover:bg-[var(--danger-tint)] hover:text-[color:var(--danger)]"><Icon name="close" size={15} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="ds-small">{filtered.length} {def.plural}</p>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="ds-focus rounded-[8px] border border-hairline-strong px-2.5 py-1 font-montserrat text-[12px] disabled:opacity-40">Anterior</button>
            <span className="font-jbmono text-[12px] text-[color:var(--fg-3)]">{page + 1}/{pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="ds-focus rounded-[8px] border border-hairline-strong px-2.5 py-1 font-montserrat text-[12px] disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}
