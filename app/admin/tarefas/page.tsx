import { createClient } from "@/lib/supabase/server";
import { TasksBoard } from "@/components/TasksBoard";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const supabase = await createClient();
  const { data: tasks } = await supabase.from("tasks").select("*").order("done").order("due_date", { nullsFirst: false }).order("created_at", { ascending: false });
  const dealIds = [...new Set((tasks ?? []).map((t: Task) => t.deal_id).filter(Boolean))] as string[];
  const { data: deals } = dealIds.length
    ? await supabase.from("deals").select("id, title").in("id", dealIds)
    : { data: [] as { id: string; title: string }[] };
  const titleById = Object.fromEntries((deals ?? []).map((d) => [d.id, d.title]));

  const rows = (tasks as Task[] ?? []).map((t) => ({
    id: t.id, title: t.title, done: t.done, due_date: t.due_date, deal_id: t.deal_id,
    dealTitle: t.deal_id ? (titleById[t.deal_id] ?? null) : null,
  }));

  const open = rows.filter((t) => !t.done).length;

  return (
    <div className="max-w-3xl">
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Execução</p>
      <h1 className="font-serif text-4xl font-semibold mb-2">Tarefas</h1>
      <p className="text-sm text-muted mb-6">{open} aberta(s) · {rows.length} no total. Tarefas de oportunidades aparecem aqui e no card do pipeline.</p>
      <TasksBoard tasks={rows} />
    </div>
  );
}
