"use client";
import { useState } from "react";
import { brl, type BrandAlloc } from "@/lib/types";
import { setBrandSplit } from "@/app/admin/crm/actions";

const BRANDS = [
  { k: "andre_kachan", l: "André Kachan" },
  { k: "salestrack", l: "Salestrack AI" },
  { k: "ai_os", l: "AI OS" },
];

export function BrandSplitEditor({ dealId, initial }: { dealId: string; initial: BrandAlloc[] }) {
  const [rows, setRows] = useState<BrandAlloc[]>(initial.length ? initial : [{ brand: "andre_kachan", value: 0 }]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);

  const set = (i: number, patch: Partial<BrandAlloc>) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const add = () => setRows((rs) => [...rs, { brand: "salestrack", value: 0 }]);
  const rm = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  async function save() {
    setSaving(true); setMsg(null);
    await setBrandSplit(dealId, rows.map((r) => ({ brand: r.brand, value: Number(r.value) || 0 })));
    setSaving(false); setMsg("✓ Alocação salva — valor total do deal atualizado.");
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Composição por marca</h2>
          <p className="text-sm text-muted">Divida o valor da oportunidade entre marcas. O total vira o valor do deal.</p>
        </div>
        <div className="text-right"><p className="label">Total</p><p className="font-serif text-2xl text-gold">{brl(total)}</p></div>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="flex-1"><label className="label">Marca</label>
              <select className="input" value={r.brand} onChange={(e) => set(i, { brand: e.target.value })}>
                {BRANDS.map((b) => <option key={b.k} value={b.k}>{b.l}</option>)}
              </select></div>
            <div className="w-40"><label className="label">Valor (R$)</label>
              <input className="input font-mono" value={r.value || ""} onChange={(e) => set(i, { value: Number(String(e.target.value).replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })} placeholder="0,00" /></div>
            <button type="button" className="btn-ghost !text-muted2 hover:!text-red-400 mb-0.5" onClick={() => rm(i)} disabled={rows.length === 1}>×</button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-ghost" onClick={add}>+ Marca</button>
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar composição"}</button>
        {msg && <span className="text-sm text-teal">{msg}</span>}
      </div>
    </div>
  );
}
