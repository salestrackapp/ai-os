"use client";
import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { BRAND_LABELS, KIND_LABELS, brl, type CatalogItem } from "@/lib/types";
import { duplicateItem, bulkSetActive, bulkMarkReviewed } from "@/app/admin/catalogo/actions";

type SortKey = "name" | "price" | "margin";
const margin = (it: CatalogItem) => (it.price != null && it.cost != null) ? it.price - it.cost : null;
const marginPct = (it: CatalogItem) => (it.price != null && it.cost != null && it.price !== 0) ? ((it.price - it.cost) / it.price) * 100 : null;

export function CatalogTable({ items, brand, kind }: { items: CatalogItem[]; brand?: string; kind?: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [dir, setDir] = useState<1 | -1>(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const rows = useMemo(() => {
    const f = items.filter((it) => !q || it.name.toLowerCase().includes(q.toLowerCase()) || (it.description ?? "").toLowerCase().includes(q.toLowerCase()));
    const val = (it: CatalogItem) => sort === "name" ? it.name.toLowerCase() : sort === "price" ? (it.price ?? -1) : (margin(it) ?? -Infinity);
    return [...f].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -dir : x > y ? dir : 0; });
  }, [items, q, sort, dir]);

  function toggleSort(k: SortKey) { if (sort === k) setDir((d) => (d === 1 ? -1 : 1)); else { setSort(k); setDir(1); } }
  function toggle(id: string) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { setSel((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))); }
  const ids = [...sel];
  function run(fn: () => Promise<void>) { start(async () => { await fn(); setSel(new Set()); }); }

  const arrow = (k: SortKey) => sort === k ? (dir === 1 ? " ↑" : " ↓") : "";
  const exportHref = `/admin/catalogo/export${brand || kind ? "?" + new URLSearchParams({ ...(brand ? { brand } : {}), ...(kind ? { kind } : {}) }) : ""}`;

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input className="input flex-1 min-w-52" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item…" />
        <a href={exportHref} className="btn-ghost">Exportar CSV</a>
        <Link href="/admin/catalogo/novo" className="btn-gold">+ Novo item</Link>
      </div>

      {sel.size > 0 && (
        <div className="card p-3 mb-3 flex flex-wrap items-center gap-3 border-goldline">
          <span className="text-sm text-gold">{sel.size} selecionado(s)</span>
          <button className="btn-ghost text-xs" disabled={pending} onClick={() => run(() => bulkSetActive(ids, true))}>Ativar</button>
          <button className="btn-ghost text-xs" disabled={pending} onClick={() => run(() => bulkSetActive(ids, false))}>Desativar</button>
          <button className="btn-ghost text-xs" disabled={pending} onClick={() => run(() => bulkMarkReviewed(ids))}>Marcar revisado</button>
          <button className="text-muted2 hover:text-cream text-xs ml-auto" onClick={() => setSel(new Set())}>limpar</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th w-8"><input type="checkbox" className="accent-[#007A94]" checked={sel.size > 0 && sel.size === rows.length} onChange={toggleAll} /></th>
            <th className="th cursor-pointer" onClick={() => toggleSort("name")}>Item{arrow("name")}</th>
            <th className="th">Marca</th><th className="th">Frentes</th>
            <th className="th cursor-pointer" onClick={() => toggleSort("price")}>Preço{arrow("price")}</th>
            <th className="th">Custo</th>
            <th className="th cursor-pointer" onClick={() => toggleSort("margin")}>Margem{arrow("margin")}</th>
            <th className="th">Status</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {rows.map((it) => {
              const m = margin(it), mp = marginPct(it);
              const neg = m != null && m < 0;
              return (
                <tr key={it.id} className={`hover:bg-navy3/50 ${sel.has(it.id) ? "bg-navy3/40" : ""}`}>
                  <td className="td"><input type="checkbox" className="accent-[#007A94]" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                  <td className="td"><p className="text-cream">{it.name}</p><p className="text-xs text-muted2">{KIND_LABELS[it.kind] ?? it.kind} · {it.unit}</p></td>
                  <td className="td"><span className={it.brand === "andre_kachan" ? "badge-gold" : "badge-teal"}>{BRAND_LABELS[it.brand]}</span></td>
                  <td className="td"><div className="flex flex-wrap gap-1">{(it.frentes ?? []).slice(0, 3).map((f) => <span key={f} className="badge-muted">{f}</span>)}{(it.frentes?.length ?? 0) > 3 && <span className="text-xs text-muted2">+{(it.frentes!.length - 3)}</span>}</div></td>
                  <td className="td font-mono text-sm">{brl(it.price)}</td>
                  <td className="td font-mono text-sm text-muted">{brl(it.cost)}</td>
                  <td className="td font-mono text-sm">{m == null ? "—" : <span className={neg ? "text-red-400" : "text-cream"}>{brl(m)}{mp != null && <span className="text-muted2"> · {mp.toFixed(0)}%</span>}</span>}</td>
                  <td className="td">{it.needs_review && <span className="badge-gold">Revisar</span>}{!it.active && <span className="badge-muted ml-1">Inativo</span>}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="text-muted2 hover:text-gold text-xs mr-3" disabled={pending} onClick={() => run(() => duplicateItem(it.id))}>Duplicar</button>
                    <Link href={`/admin/catalogo/${it.id}`} className="text-gold text-sm hover:underline">Editar</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-muted2" colSpan={9}>Nenhum item{q ? " para a busca" : ""}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
