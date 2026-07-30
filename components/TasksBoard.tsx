"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createTask, toggleTask, deleteTask } from "@/app/admin/tarefas/actions";

type Row = { id: string; title: string; done: boolean; due_date: string | null; deal_id: string | null; dealTitle: string | null };

export function TasksBoard({ tasks }: { tasks: Row[] }) {
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();

  const shown = tasks.filter((t) => filter === "all" ? true : filter === "open" ? !t.done : t.done);
  function add() {
    const t = title.trim(); if (!t) return;
    start(async () => { await createTask({ title: t, due_date: due || null }); setTitle(""); setDue(""); });
  }
  const overdue = (t: Row) => t.due_date && !t.done && new Date(t.due_date + "T23:59:59") < new Date();

  return (
    <div>
      <form className="card p-4 mb-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="flex-1 min-w-52"><label className="label">Nova tarefa (geral)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" /></div>
        <div className="w-44"><label className="label">Vencimento</label>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <button className="btn-gold" disabled={pending || !title.trim()}>Adicionar</button>
      </form>

      <div className="flex gap-2 mb-4">
        {([["open", "Abertas"], ["done", "Concluídas"], ["all", "Todas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`badge-muted ${filter === k ? "!text-gold !border-goldline" : ""}`}>{l}</button>
        ))}
      </div>

      <div className="card divide-y divide-line">
        {shown.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <input type="checkbox" className="accent-[#007A94]" checked={t.done} onChange={() => start(() => toggleTask(t.id, !t.done).then(() => {}))} />
            <span className={`flex-1 ${t.done ? "line-through text-muted2" : "text-cream"}`}>{t.title}</span>
            {t.deal_id && <Link href={`/admin/crm/${t.deal_id}`} className="text-xs text-gold hover:underline shrink-0">{t.dealTitle ?? "deal"}</Link>}
            {t.due_date && <span className={`text-[13px] shrink-0 ${overdue(t) ? "text-red-400" : "text-muted2"}`}>{new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
            <button className="text-muted2 hover:text-red-400 text-xs shrink-0" onClick={() => start(() => deleteTask(t.id).then(() => {}))}>excluir</button>
          </div>
        ))}
        {shown.length === 0 && <p className="px-4 py-6 text-sm text-muted2">Nenhuma tarefa {filter === "open" ? "aberta" : filter === "done" ? "concluída" : ""}.</p>}
      </div>
    </div>
  );
}
