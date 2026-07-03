"use client";
import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { DEAL_STAGES, STAGE_LABELS, BRAND_LABELS, brl, daysSince, STAGNATION_DAYS, type Deal } from "@/lib/types";
import { moveDealToStage, markLost } from "@/app/admin/crm/actions";
import { createTask } from "@/app/admin/tarefas/actions";

type TaskCount = { open: number; total: number };

function CardInner({ d, overlay = false, tc }: { d: Deal; overlay?: boolean; tc?: TaskCount }) {
  const days = daysSince(d.last_activity_at);
  const stagnant = days !== null && days >= STAGNATION_DAYS && d.stage !== "cliente";
  return (
    <div className={`bg-navy3 border rounded-lg p-3 ${stagnant ? "border-amber-500/60" : "border-line"} ${overlay ? "shadow-2xl rotate-1" : ""}`}>
      <p className="text-sm text-cream leading-snug">{d.title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.icp && <span className="badge-muted">ICP {d.icp}</span>}
        <span className={d.score >= 20 ? "badge-teal" : "badge-muted"}>score {d.score}</span>
        {stagnant && <span className="badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-amber-400 border-amber-500/40 bg-amber-500/10">estagnado</span>}
        {tc && tc.open > 0 && <span className="badge-muted">✓ {tc.open} tarefa(s)</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted2">{BRAND_LABELS[d.brand] ?? d.brand} · {brl(d.value_estimated)}</p>
      {d.next_step && <p className="mt-1 text-[11px] text-muted truncate">→ {d.next_step}</p>}
      {days !== null && <p className="mt-1 text-[10px] text-muted2">{days === 0 ? "atividade hoje" : `${days} d sem atividade`}</p>}
    </div>
  );
}

function DraggableCard({ d, tc }: { d: Deal; tc?: TaskCount }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  function add() {
    const t = title.trim(); if (!t) return;
    start(async () => { await createTask({ title: t, deal_id: d.id }); setTitle(""); setAdding(false); });
  }
  return (
    <div className={isDragging ? "opacity-30" : ""}>
      <div ref={setNodeRef} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <Link href={`/admin/crm/${d.id}`} onClick={(e) => e.stopPropagation()} className="block">
          <CardInner d={d} tc={tc} />
        </Link>
      </div>
      {adding ? (
        <div className="mt-1 flex gap-1">
          <input autoFocus className="input !py-1 !text-xs" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }} placeholder="Tarefa…" />
          <button className="text-gold text-xs px-1" disabled={pending} onClick={add}>ok</button>
        </div>
      ) : (
        <button className="mt-1 text-[10px] text-muted2 hover:text-gold" onClick={() => setAdding(true)}>+ tarefa</button>
      )}
    </div>
  );
}

function Column({ id, label, deals, taskCounts }: { id: string; label: string; deals: Deal[]; taskCounts: Record<string, TaskCount> }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const sum = deals.reduce((a, d) => a + (d.value_estimated ?? 0), 0);
  return (
    <div ref={setNodeRef} className={`card p-3 ${isOver ? "ring-1 ring-goldline" : ""}`}>
      <div className="px-1 mb-3">
        <p className="text-[10px] uppercase tracking-[.18em] text-gold">{label} <span className="text-muted2">· {deals.length}</span></p>
        <p className="text-[10px] text-muted2 font-mono">{brl(sum)}</p>
      </div>
      <div className="space-y-2 min-h-12">
        {deals.map((d) => <DraggableCard key={d.id} d={d} tc={taskCounts[d.id]} />)}
        {deals.length === 0 && <p className="text-xs text-muted2 px-1 pb-1">—</p>}
      </div>
    </div>
  );
}

export function KanbanBoard({ initial, taskCounts = {} }: { initial: Deal[]; taskCounts?: Record<string, TaskCount> }) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [q, setQ] = useState(""); const [brand, setBrand] = useState("");
  const [icp, setIcp] = useState(""); const [minScore, setMinScore] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(() => deals.filter((d) =>
    (!q || d.title.toLowerCase().includes(q.toLowerCase())) &&
    (!brand || d.brand === brand) &&
    (!icp || String(d.icp) === icp) &&
    (!minScore || d.score >= Number(minScore))
  ), [deals, q, brand, icp, minScore]);

  const byStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    [...DEAL_STAGES, "perdido"].forEach((s) => (m[s] = []));
    filtered.forEach((d) => (m[d.stage] ??= []).push(d));
    return m;
  }, [filtered]);

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const over = e.over?.id ? String(e.over.id) : null;
    const id = String(e.active.id);
    const deal = deals.find((d) => d.id === id);
    if (!over || !deal || deal.stage === over) return;
    if (over === "perdido") { setLostFor(id); setReason(""); return; }
    setDeals((ds) => ds.map((d) => d.id === id ? { ...d, stage: over, last_activity_at: new Date().toISOString() } : d));
    moveDealToStage(id, over);
  }

  async function confirmLost() {
    const id = lostFor; const r = reason.trim();
    if (!id || !r) return;
    setDeals((ds) => ds.map((d) => d.id === id ? { ...d, stage: "perdido", lost_reason: r } : d));
    setLostFor(null); setReason("");
    await markLost(id, r);
  }

  const active = activeId ? deals.find((d) => d.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* barra de filtros */}
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48"><label className="label">Buscar</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="título do deal…" /></div>
        <div className="w-40"><label className="label">Marca</label>
          <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Todas</option><option value="andre_kachan">André Kachan</option><option value="salestrack">Salestrack AI</option>
          </select></div>
        <div className="w-24"><label className="label">ICP</label>
          <select className="input" value={icp} onChange={(e) => setIcp(e.target.value)}>
            <option value="">—</option><option>1</option><option>2</option><option>3</option>
          </select></div>
        <div className="w-28"><label className="label">Score mín.</label>
          <input className="input font-mono" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="0" /></div>
        {(q || brand || icp || minScore) && (
          <button className="btn-ghost" onClick={() => { setQ(""); setBrand(""); setIcp(""); setMinScore(""); }}>Limpar</button>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 items-start">
        {DEAL_STAGES.map((s) => <Column key={s} id={s} label={STAGE_LABELS[s]} deals={byStage[s]} taskCounts={taskCounts} />)}
      </div>

      {/* zona de perda */}
      <PerdidoZone deals={byStage["perdido"]} />

      <DragOverlay>{active ? <CardInner d={active} overlay /> : null}</DragOverlay>

      {lostFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setLostFor(null)}>
          <div className="card p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-2xl font-semibold mb-2">Marcar como perdido</h3>
            <p className="text-sm text-muted mb-4">Registre o motivo — obrigatório e auditado.</p>
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: escolheu concorrente, sem budget, timing…" autoFocus />
            <div className="mt-4 flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setLostFor(null)}>Cancelar</button>
              <button className="btn-gold" disabled={!reason.trim()} onClick={confirmLost}>Confirmar perda</button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

function PerdidoZone({ deals }: { deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "perdido" });
  const sum = deals.reduce((a, d) => a + (d.value_estimated ?? 0), 0);
  return (
    <div ref={setNodeRef}
      className={`mt-3 card p-3 border-dashed ${isOver ? "ring-1 ring-amber-500/60 border-amber-500/60" : ""}`}>
      <p className="text-[10px] uppercase tracking-[.18em] text-muted2 px-1">
        Perdido <span>· {deals.length}{sum ? ` · ${brl(sum)}` : ""}</span>
        <span className="ml-2 normal-case tracking-normal text-muted2">— arraste um card aqui para registrar a perda</span>
      </p>
      {deals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {deals.map((d) => (
            <Link key={d.id} href={`/admin/crm/${d.id}`} className="text-xs text-muted2 hover:text-cream border border-line rounded px-2 py-1">
              {d.title}{d.lost_reason ? ` · ${d.lost_reason}` : ""}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
