"use client";
import { useState, useMemo } from "react";
import { ASSET_TYPE_LABELS } from "@/lib/types";

type Item = { id: string; title: string; type: string; frente: string | null; created_at: string; url: string | null; tags: string[] };

export function LibraryGrid({ items }: { items: Item[] }) {
  const [q, setQ] = useState(""); const [type, setType] = useState("");
  const types = useMemo(() => [...new Set(items.map((i) => i.type))], [items]);
  const filtered = items.filter((i) =>
    (!type || i.type === type) &&
    (!q || i.title.toLowerCase().includes(q.toLowerCase()) || i.tags.some((t) => t.toLowerCase().includes(q.toLowerCase())))
  );
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input flex-1 min-w-52" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título ou tag…" />
        <select className="input w-48" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>{types.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t] ?? t}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((i) => (
          <div key={i.id} className="card p-5 flex flex-col">
            <span className="badge-muted self-start mb-3">{ASSET_TYPE_LABELS[i.type] ?? i.type}</span>
            <p className="font-serif text-lg font-semibold flex-1">{i.title}</p>
            {i.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{i.tags.slice(0, 4).map((t) => <span key={t} className="text-[10px] text-muted2 border border-line rounded px-1.5 py-0.5">{t}</span>)}</div>}
            <p className="text-[11px] text-muted2 mt-2">{new Date(i.created_at).toLocaleDateString("pt-BR")}</p>
            {i.url && <a href={i.url} target="_blank" className="btn-gold justify-center mt-3">Abrir / baixar</a>}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted2 col-span-full">Nenhum material{q || type ? " para o filtro" : " disponível ainda"}.</p>}
      </div>
    </div>
  );
}
