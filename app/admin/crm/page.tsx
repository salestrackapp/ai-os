import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEAL_STAGES, STAGE_LABELS, BRAND_LABELS, brl, type Deal } from "@/lib/types";
import { moveDeal, createDeal } from "./actions";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();
  const { data: deals } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
  const grouped: Record<string, Deal[]> = {};
  DEAL_STAGES.forEach((s) => (grouped[s] = []));
  (deals as Deal[] | null)?.forEach((d) => { (grouped[d.stage] ??= []).push(d); });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Pipeline · sinal → cliente</p>
          <h1 className="font-serif text-4xl font-semibold">CRM</h1>
        </div>
        <Link href="/admin/crm/importar" className="btn-ghost">Importar do HubSpot (CSV)</Link>
      </div>

      <form action={createDeal} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52"><label className="label">Novo deal</label>
          <input className="input" name="title" placeholder="Empresa · oportunidade" required /></div>
        <div className="w-24"><label className="label">ICP</label>
          <select className="input" name="icp"><option value="">—</option><option>1</option><option>2</option><option>3</option></select></div>
        <div className="w-24"><label className="label">Score</label>
          <input className="input font-mono" name="score" placeholder="0" /></div>
        <div className="w-32"><label className="label">Valor est.</label>
          <input className="input font-mono" name="value" placeholder="R$" /></div>
        <div className="w-44"><label className="label">Marca</label>
          <select className="input" name="brand">
            <option value="andre_kachan">André Kachan</option>
            <option value="salestrack">Salestrack AI</option>
          </select></div>
        <button className="btn-gold">Adicionar</button>
      </form>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 items-start">
        {DEAL_STAGES.map((stage) => (
          <div key={stage} className="card p-3">
            <p className="text-[10px] uppercase tracking-[.18em] text-gold px-1 mb-3">
              {STAGE_LABELS[stage]} <span className="text-muted2">· {grouped[stage].length}</span>
            </p>
            <div className="space-y-2">
              {grouped[stage].map((d) => (
                <div key={d.id} className="bg-navy3 border border-line rounded-lg p-3">
                  <p className="text-sm text-cream leading-snug">{d.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.icp && <span className="badge-muted">ICP {d.icp}</span>}
                    <span className={d.score >= 20 ? "badge-teal" : "badge-muted"}>score {d.score}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted2">{BRAND_LABELS[d.brand] ?? d.brand} · {brl(d.value_estimated)}</p>
                  <div className="mt-2 flex justify-between">
                    <form action={moveDeal.bind(null, d.id, "prev")}><button className="text-muted2 hover:text-gold text-xs">◀</button></form>
                    <form action={moveDeal.bind(null, d.id, "next")}><button className="text-muted2 hover:text-gold text-xs">▶</button></form>
                  </div>
                </div>
              ))}
              {grouped[stage].length === 0 && <p className="text-xs text-muted2 px-1 pb-1">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
