"use client";
import { useState } from "react";
import Link from "next/link";
import {
  STAGE_LABELS, DEAL_STAGES, BRAND_LABELS, brl, daysSince, dealBrandValues,
  type Deal, type SignalDefinition, type Contact, type Organization, type Task,
} from "@/lib/types";
import { updateDeal, setDealSignals, addNote, markLost, convertToClient, linkContact } from "@/app/admin/crm/actions";
import { BrandSplitEditor } from "@/components/crm/BrandSplitEditor";
import { DealTasks } from "@/components/crm/DealTasks";

type Activity = { id: string; kind: string; payload: Record<string, unknown> | null; created_at: string };

function actText(a: Activity): string {
  const p = a.payload ?? {};
  if (a.kind === "nota") return String(p.text ?? "");
  if (a.kind === "estagio") return `Estágio: ${STAGE_LABELS[String(p.from)] ?? p.from} → ${STAGE_LABELS[String(p.to)] ?? p.to}`;
  if (a.kind === "sistema") return p.event === "perdido" ? `Perdido — ${p.reason}` : p.event === "convertido_cliente" ? "Convertido em cliente" : JSON.stringify(p);
  return JSON.stringify(p);
}

export function DealDetail({ deal, signalDefs, activities, contacts, orgs, tasks }: {
  deal: Deal; signalDefs: SignalDefinition[]; activities: Activity[]; contacts: Contact[];
  orgs: Organization[]; tasks: Task[];
}) {
  const [signals, setSignals] = useState<string[]>(deal.signals ?? []);
  const [score, setScore] = useState<number>(deal.score);
  const [note, setNote] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function toggle(sigId: string) {
    const next = signals.includes(sigId) ? signals.filter((s) => s !== sigId) : [...signals, sigId];
    setSignals(next);
    setScore(next.reduce((sum, id) => sum + (signalDefs.find((d) => d.id === id)?.weight ?? 0), 0));
    await setDealSignals(deal.id, next);
  }
  async function submitNote() {
    const t = note.trim(); if (!t) return;
    setPending(true); await addNote(deal.id, t); setNote(""); setPending(false);
  }
  async function confirmLost() {
    if (!reason.trim()) return;
    setLostOpen(false); await markLost(deal.id, reason.trim());
  }

  const hot = score >= 20;
  const days = daysSince(deal.last_activity_at);

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Coluna principal */}
      <div className="lg:col-span-2 space-y-5">
        <div className="card p-6">
          <form action={updateDeal.bind(null, deal.id)} className="space-y-4">
            <input className="input !text-2xl font-serif !py-2" name="title" defaultValue={deal.title} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><label className="label">Estágio</label>
                <select className="input" name="stage" defaultValue={deal.stage}>
                  {[...DEAL_STAGES, "perdido"].map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select></div>
              <div><label className="label">Marca</label>
                <select className="input" name="brand" defaultValue={deal.brand}>
                  <option value="andre_kachan">André Kachan</option><option value="salestrack">Salestrack AI</option><option value="ai_os">AI OS</option>
                </select></div>
              <div><label className="label">ICP</label>
                <select className="input" name="icp" defaultValue={deal.icp ?? ""}>
                  <option value="">—</option><option>1</option><option>2</option><option>3</option>
                </select></div>
              <div><label className="label">Conta</label>
                <select className="input" name="org_id" defaultValue={deal.org_id ?? ""}>
                  <option value="">— nenhuma —</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select></div>
              <div><label className="label">Valor estimado</label>
                <input className="input font-mono" name="value" defaultValue={deal.value_estimated ?? ""} placeholder="R$" /></div>
              <div><label className="label">Fechamento previsto</label>
                <input className="input" type="date" name="expected_close" defaultValue={deal.expected_close ?? ""} /></div>
              <div className="md:col-span-1"><label className="label">Próximo passo</label>
                <input className="input" name="next_step" defaultValue={deal.next_step ?? ""} placeholder="ex.: enviar proposta" /></div>
            </div>
            <button className="btn-gold">Salvar alterações</button>
          </form>
        </div>

        {/* Composição por marca (multi-marca) */}
        <BrandSplitEditor dealId={deal.id} initial={deal.brand_split && deal.brand_split.length ? deal.brand_split : dealBrandValues(deal)} />

        {/* Tarefas */}
        <DealTasks dealId={deal.id} tasks={tasks} />

        {/* Protocolo de sinais */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-2xl font-semibold">Protocolo de Sinais</h2>
            <div className="text-right">
              <span className={`badge ${hot ? "badge-teal" : "badge-muted"}`}>score {score}</span>
              {hot && <p className="text-xs text-teal mt-1">Abordar agora</p>}
            </div>
          </div>
          <div className="space-y-2">
            {signalDefs.map((s) => (
              <label key={s.id} className="flex items-start gap-3 text-sm text-muted hover:text-cream cursor-pointer">
                <input type="checkbox" className="accent-[#C89B3C] mt-0.5" checked={signals.includes(s.id)} onChange={() => toggle(s.id)} />
                <span className="flex-1">{s.label}</span>
                <span className="text-muted2 font-mono text-xs">+{s.weight}</span>
              </label>
            ))}
            {signalDefs.length === 0 && <p className="text-sm text-muted2">Nenhum sinal ativo. Configure em Configurações → Sinais.</p>}
          </div>
        </div>

        {/* Timeline */}
        <div className="card p-6">
          <h2 className="font-serif text-2xl font-semibold mb-4">Timeline</h2>
          <div className="flex gap-2 mb-5">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota rápida…"
              onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }} />
            <button className="btn-gold shrink-0" disabled={pending || !note.trim()} onClick={submitNote}>Anotar</button>
          </div>
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="badge-muted shrink-0 self-start">{a.kind}</span>
                <div className="flex-1">
                  <p className="text-cream">{actText(a)}</p>
                  <p className="text-[11px] text-muted2">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </li>
            ))}
            {activities.length === 0 && <li className="text-sm text-muted2">Sem atividades ainda — adicione uma nota.</li>}
          </ul>
        </div>
      </div>

      {/* Coluna lateral */}
      <div className="space-y-5">
        <div className="card p-6">
          <p className="label">Resumo</p>
          <p className="text-sm text-muted mt-2">{BRAND_LABELS[deal.brand] ?? deal.brand}</p>
          <p className="font-serif text-3xl font-semibold text-gold">{brl(deal.value_estimated)}</p>
          <p className="text-xs text-muted2 mt-1">{STAGE_LABELS[deal.stage]}{days !== null ? ` · ${days} d sem atividade` : ""}</p>
          {deal.lost_reason && <p className="text-xs text-amber-400 mt-2">Perdido: {deal.lost_reason}</p>}
        </div>

        {/* Contatos */}
        <div className="card p-6">
          <h3 className="font-serif text-xl font-semibold mb-3">Contatos</h3>
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="text-cream truncate">{c.name}{deal.contact_id === c.id && <span className="text-gold text-xs"> · principal</span>}</p>
                  {c.email && <p className="text-[11px] text-muted2 truncate">{c.email}</p>}
                </div>
                {deal.contact_id === c.id
                  ? <button className="text-muted2 hover:text-cream text-xs" onClick={() => linkContact(deal.id, "")}>desvincular</button>
                  : <button className="text-gold hover:underline text-xs" onClick={() => linkContact(deal.id, c.id)}>principal</button>}
              </div>
            ))}
            {contacts.length === 0 && <p className="text-sm text-muted2">Nenhum contato na conta. Cadastre em Contatos.</p>}
          </div>
        </div>

        {/* Ações */}
        <div className="card p-6 space-y-3">
          <h3 className="font-serif text-xl font-semibold">Ações</h3>
          {deal.stage !== "cliente" && (
            <form action={convertToClient.bind(null, deal.id)} className="space-y-2">
              {!deal.org_id && (
                <>
                  <input className="input" name="org_name" placeholder="Nome da organização" defaultValue={deal.title} />
                  <input className="input" name="cnpj" placeholder="CNPJ (opcional)" />
                </>
              )}
              <button className="btn-gold w-full justify-center">Converter em cliente</button>
            </form>
          )}
          {deal.stage !== "perdido" && (
            <button className="btn-ghost w-full justify-center !text-muted2 hover:!text-cream" onClick={() => { setReason(""); setLostOpen(true); }}>
              Marcar como perdido
            </button>
          )}
        </div>
      </div>

      {lostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setLostOpen(false)}>
          <div className="card p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-2xl font-semibold mb-2">Marcar como perdido</h3>
            <p className="text-sm text-muted mb-4">Motivo obrigatório e auditado.</p>
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <div className="mt-4 flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setLostOpen(false)}>Cancelar</button>
              <button className="btn-gold" disabled={!reason.trim()} onClick={confirmLost}>Confirmar perda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
