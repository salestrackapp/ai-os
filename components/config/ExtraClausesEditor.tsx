"use client";
import { useState } from "react";

type Extra = { titulo: string; corpo: string };

export function ExtraClausesEditor({ initial }: { initial: Extra[] }) {
  const [rows, setRows] = useState<Extra[]>(initial.length ? initial : []);
  const set = (i: number, patch: Partial<Extra>) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="border border-line rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <input className="input" name="extra_titulo" value={r.titulo} placeholder="Título da cláusula" onChange={(e) => set(i, { titulo: e.target.value })} />
            <button type="button" className="text-muted2 hover:text-red-400 shrink-0" onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))}>×</button>
          </div>
          <textarea className="input" name="extra_corpo" rows={2} value={r.corpo} placeholder="Texto da cláusula" onChange={(e) => set(i, { corpo: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn-ghost text-xs" onClick={() => setRows((xs) => [...xs, { titulo: "", corpo: "" }])}>+ Cláusula extra</button>
    </div>
  );
}
