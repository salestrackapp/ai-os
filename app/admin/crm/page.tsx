import { createClient } from "@/lib/supabase/server";
import type { Deal } from "@/lib/types";
import { createDeal } from "./actions";
import { CrmNav } from "@/components/crm/CrmNav";
import { KanbanBoard } from "@/components/crm/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();
  const { data: deals } = await supabase.from("deals").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Pipeline · sinal → cliente</p>
          <h1 className="font-serif text-4xl font-semibold">CRM</h1>
        </div>
      </div>

      <CrmNav />

      <form action={createDeal} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52"><label className="label">Novo deal</label>
          <input className="input" name="title" placeholder="Empresa · oportunidade" required /></div>
        <div className="w-24"><label className="label">ICP</label>
          <select className="input" name="icp"><option value="">—</option><option>1</option><option>2</option><option>3</option></select></div>
        <div className="w-32"><label className="label">Valor est.</label>
          <input className="input font-mono" name="value" placeholder="R$" /></div>
        <div className="w-44"><label className="label">Marca</label>
          <select className="input" name="brand">
            <option value="andre_kachan">André Kachan</option>
            <option value="salestrack">Salestrack AI</option>
          </select></div>
        <button className="btn-gold">Adicionar</button>
      </form>

      <KanbanBoard initial={(deals as Deal[]) ?? []} />
    </div>
  );
}
