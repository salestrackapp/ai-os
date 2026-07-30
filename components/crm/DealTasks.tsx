"use client";
import { useState, useTransition } from "react";
import { type Task } from "@/lib/types";
import { createTask, toggleTask, deleteTask } from "@/app/admin/tarefas/actions";

export function DealTasks({ dealId, tasks }: { dealId: string; tasks: Task[] }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();

  function add() {
    const t = title.trim(); if (!t) return;
    start(async () => { await createTask({ title: t, deal_id: dealId, due_date: due || null }); setTitle(""); setDue(""); });
  }
  const open = tasks.filter((t) => !t.done).length;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl font-semibold">Tarefas</h2>
        <span className="badge-muted">{open} aberta(s) · {tasks.length}</span>
      </div>
      <div className="flex gap-2 mb-4">
        <input className="input flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa…"
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <input className="input w-40" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn-gold shrink-0" onClick={add} disabled={pending || !title.trim()}>Adicionar</button>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="accent-[#007A94]" checked={t.done} onChange={() => start(() => toggleTask(t.id, !t.done).then(() => {}))} />
            <span className={`flex-1 ${t.done ? "line-through text-muted2" : "text-cream"}`}>{t.title}</span>
            {t.due_date && <span className="text-[13px] text-muted2">{new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
            <button className="text-muted2 hover:text-red-400 text-xs" onClick={() => start(() => deleteTask(t.id).then(() => {}))}>excluir</button>
          </li>
        ))}
        {tasks.length === 0 && <li className="text-sm text-muted2">Nenhuma tarefa. Adicione a primeira.</li>}
      </ul>
    </div>
  );
}
