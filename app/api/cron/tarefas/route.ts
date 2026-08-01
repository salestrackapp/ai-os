import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notifications/notify";

/**
 * Avisa sobre tarefas vencendo e atrasadas. Chamado pelo Vercel Cron
 * (Authorization: Bearer CRON_SECRET) ou manualmente com ?key=CRON_SECRET.
 * Sem CRON_SECRET definido, recusa — nunca fica aberto.
 *
 * Os marcadores notified_due_soon / notified_overdue garantem um aviso por tarefa por fase;
 * sem eles, cada execução reavisaria a mesma tarefa indefinidamente.
 */
export async function GET(req: NextRequest) {
  return comRegistro("tarefas", req, async () => {
  const sb = createServiceClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const [vencendo, atrasadas] = await Promise.all([
    sb.from("tasks").select("id, title, deal_id, org_id, created_by, due_date")
      .eq("done", false).eq("notified_due_soon", false)
      .gte("due_date", hoje).lte("due_date", amanha).not("created_by", "is", null),
    sb.from("tasks").select("id, title, deal_id, org_id, created_by, due_date")
      .eq("done", false).eq("notified_overdue", false)
      .lt("due_date", hoje).not("created_by", "is", null),
  ]);

  const rodar = async (
    linhas: { id: string; title: string; deal_id: string | null; org_id: string | null; created_by: string; due_date: string }[],
    event: "task_due_soon" | "task_overdue",
    marcador: "notified_due_soon" | "notified_overdue",
  ) => {
    for (const t of linhas) {
      await notify({
        userId: t.created_by,
        event,
        title: event === "task_overdue" ? `Tarefa atrasada: ${t.title}` : `Tarefa vencendo: ${t.title}`,
        body: `Prazo em ${t.due_date}.`,
        url: t.deal_id ? `/admin/crm/${t.deal_id}` : "/admin/tarefas",
        entityType: "tasks",
        entityId: t.id,
        orgId: t.org_id,
      });
      await sb.from("tasks").update({ [marcador]: true }).eq("id", t.id);
    }
    return linhas.length;
  };

  const nVencendo = await rodar(vencendo.data ?? [], "task_due_soon", "notified_due_soon");
  const nAtrasadas = await rodar(atrasadas.data ?? [], "task_overdue", "notified_overdue");

  return { vencendo: nVencendo, atrasadas: nAtrasadas };
  });
}
