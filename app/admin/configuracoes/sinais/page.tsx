import { createClient } from "@/lib/supabase/server";
import { ConfigNav } from "@/components/config/ConfigNav";
import type { SignalDefinition } from "@/lib/types";
import { createSignal, updateSignal, deleteSignal } from "./actions";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

export default async function SinaisPage() {
  const supabase = await createClient();
  const { data: signals } = await supabase.from("signal_definitions").select("*").is("deleted_at", null).order("sort");

  return (
    <ContentArea>
      <div className="max-w-3xl">
        <p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">Método · Protocolo de Sinais</p>
        <h1 className="font-serif text-4xl font-semibold mb-6">Sinais</h1>
        <ConfigNav />
        <p className="text-sm text-muted mb-5">Cada sinal marcado num deal soma seu peso ao <b className="text-cream">score</b>. Score ≥ 20 sinaliza “abordar agora”. Calibre aqui os pesos do método.</p>

        <div className="space-y-2 mb-8">
          {(signals as SignalDefinition[] | null)?.map((s) => (
            <form key={s.id} action={updateSignal.bind(null, s.id)} className="card p-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-64"><label className="label">Rótulo</label>
                <input className="input" name="label" defaultValue={s.label} /></div>
              <div className="w-20"><label className="label">Peso</label>
                <input className="input font-mono" name="weight" type="number" defaultValue={s.weight} /></div>
              <div className="w-20"><label className="label">Ordem</label>
                <input className="input font-mono" name="sort" type="number" defaultValue={s.sort} /></div>
              <label className="flex items-center gap-2 text-sm text-muted pb-2">
                <input type="checkbox" name="active" defaultChecked={s.active} className="accent-[#007A94]" /> Ativo
              </label>
              <button className="btn-gold">Salvar</button>
              <button formAction={deleteSignal.bind(null, s.id)} className="btn-ghost !text-muted2 hover:!text-red-400 text-xs">Excluir</button>
            </form>
          ))}
          {(!signals || signals.length === 0) && <p className="text-sm text-muted2">Nenhum sinal cadastrado.</p>}
        </div>

        <form action={createSignal} className="card p-4 flex flex-wrap items-end gap-3 border-goldline">
          <div className="flex-1 min-w-64"><label className="label">Novo sinal — rótulo</label>
            <input className="input" name="label" placeholder="ex.: Contratou head de vendas" required /></div>
          <div className="w-20"><label className="label">Peso</label>
            <input className="input font-mono" name="weight" type="number" defaultValue={5} /></div>
          <div className="w-20"><label className="label">Ordem</label>
            <input className="input font-mono" name="sort" type="number" defaultValue={0} /></div>
          <button className="btn-gold">Adicionar</button>
        </form>
      </div>
    </ContentArea>
  );
}
