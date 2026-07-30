import { createClient } from "@/lib/supabase/server";
import { TasksBoard } from "@/components/TasksBoard";
import type { Task } from "@/lib/types";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

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
    <ContentArea>
      <div className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Tarefas" }]} className="mb-4" />
        <PageHeader eyebrow="Comercial · execução" title="Tarefas"
          subtitle={`${open} aberta(s) · ${rows.length} no total. Tarefas de oportunidades aparecem aqui e no card do pipeline.`}
          comoUsar={<HelpButton routeKey="/admin/comercial" />} />
        <TasksBoard tasks={rows} />
      </div>
    </ContentArea>
  );
}
