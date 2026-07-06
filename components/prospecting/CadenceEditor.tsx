"use client";
import { useState } from "react";
import { CHANNEL_LABELS, ICP_LABELS } from "@/lib/prospecting/types";

type Step = { dia: number; canal: string; tipo: string; modelo: string };
type Props = {
  action: (formData: FormData) => void;
  cadence?: { id: string; name: string; icp: string | null; steps: Step[] };
};

const CHANNELS = ["email", "whatsapp", "linkedin", "ligacao"];
const CHANNEL_ICON: Record<string, string> = { email: "📧", whatsapp: "💬", linkedin: "🔗", ligacao: "📞" };

export function CadenceEditor({ action, cadence }: Props) {
  const [steps, setSteps] = useState<Step[]>(
    cadence?.steps?.length ? cadence.steps.map((s) => ({ dia: s.dia ?? 0, canal: s.canal ?? "email", tipo: s.tipo ?? "toque", modelo: s.modelo ?? "" })) : [{ dia: 0, canal: "email", tipo: "toque", modelo: "" }],
  );

  const patch = (i: number, p: Partial<Step>) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...p } : st)));
  const add = () => setSteps((s) => [...s, { dia: (s[s.length - 1]?.dia ?? 0) + 2, canal: "email", tipo: "toque", modelo: "" }]);
  const remove = (i: number) => setSteps((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));
  const move = (i: number, dir: number) => setSteps((s) => { const a = [...s]; const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const toques = steps.filter((s) => s.tipo === "toque").length;
  const duracao = steps.reduce((m, s) => Math.max(m, s.dia), 0);

  return (
    <form action={action} className="space-y-4">
      {cadence && <input type="hidden" name="id" value={cadence.id} />}
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52"><label className="label">Nome da cadência</label><input name="name" defaultValue={cadence?.name ?? ""} required className="input w-full" placeholder="Ex.: Cadência ICP1 · Fundadores" /></div>
        <div className="w-56"><label className="label">ICP</label>
          <select name="icp" defaultValue={cadence?.icp ?? ""} className="input w-full">
            <option value="">— sem ICP —</option>
            {Object.keys(ICP_LABELS).map((k) => <option key={k} value={k}>{ICP_LABELS[k]}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="label">Passos da cadência</p>
        <p className="text-[11px] text-muted2">{toques} toque(s) · {steps.length} passo(s) · {duracao} dias</p>
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="bg-navy3 border border-line rounded-lg p-3 flex flex-wrap items-start gap-3">
            {/* reorder + índice */}
            <div className="flex flex-col items-center pt-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted2 hover:text-gold disabled:opacity-30 text-xs leading-none">▲</button>
              <span className="w-6 h-6 my-1 rounded-full bg-[rgba(79, 31, 255,.14)] border border-goldline text-gold flex items-center justify-center font-mono text-xs">{i + 1}</span>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="text-muted2 hover:text-gold disabled:opacity-30 text-xs leading-none">▼</button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted2">Dia</span>
              <input type="number" min={0} value={s.dia} onChange={(e) => patch(i, { dia: Number(e.target.value) })} className="input w-16 text-sm text-center" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted2">Canal</span>
              <select value={s.canal} onChange={(e) => patch(i, { canal: e.target.value })} className="input text-sm w-36">
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_ICON[c]} {CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted2">Tipo</span>
              <select value={s.tipo} onChange={(e) => patch(i, { tipo: e.target.value })} className="input text-sm w-32">
                <option value="toque">Toque (agente)</option>
                <option value="tarefa">Tarefa manual</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-52">
              <span className="text-[10px] uppercase tracking-wider text-muted2">Diretriz do passo (o agente usa isto)</span>
              <input value={s.modelo} onChange={(e) => patch(i, { modelo: e.target.value })} className="input text-sm w-full" placeholder="Ex.: Abertura pela dor, sem oferecer serviço. CTA único de agenda." />
            </div>

            <button type="button" onClick={() => remove(i)} disabled={steps.length === 1} title="Remover passo" className="text-muted2 hover:text-red-400 disabled:opacity-30 pt-6">✕</button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={add} className="btn-ghost text-sm">+ Adicionar passo</button>
        <button type="submit" className="btn-gold text-sm">{cadence ? "Salvar cadência" : "Criar cadência"}</button>
      </div>
      <p className="text-[11px] text-muted2">Dica: <b>Toque</b> em e-mail/WhatsApp gera um rascunho para a fila de aprovação; <b>Tarefa</b> (LinkedIn/ligação) entra como tarefa manual do operador.</p>
    </form>
  );
}
