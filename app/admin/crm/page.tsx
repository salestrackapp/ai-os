import { createClient } from "@/lib/supabase/server";
import type { Deal, Organization, Contact } from "@/lib/types";
import { CrmNav } from "@/components/crm/CrmNav";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { NewDealForm } from "@/components/crm/NewDealForm";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();
  const [{ data: deals }, { data: orgs }, { data: contacts }, { data: tasks }] = await Promise.all([
    supabase.from("deals").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("*").eq("is_salestrack", false).order("name"),
    supabase.from("contacts").select("*").order("name"),
    supabase.from("tasks").select("deal_id, done"),
  ]);

  const taskCounts: Record<string, { open: number; total: number }> = {};
  (tasks ?? []).forEach((t: { deal_id: string | null; done: boolean }) => {
    if (!t.deal_id) return;
    const c = (taskCounts[t.deal_id] ??= { open: 0, total: 0 });
    c.total++; if (!t.done) c.open++;
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Pipeline · sinal → cliente</p>
          <h1 className="font-serif text-4xl font-semibold">CRM</h1>
        </div>
      </div>

      <CrmNav />

      <NewDealForm orgs={(orgs as Organization[]) ?? []} contacts={(contacts as Contact[]) ?? []} />

      <KanbanBoard initial={(deals as Deal[]) ?? []} taskCounts={taskCounts} />
    </div>
  );
}
