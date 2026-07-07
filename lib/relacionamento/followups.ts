import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "./notify";

/**
 * Dispara lembretes de follow-up vencido (snooze_until <= agora, conversa não arquivada).
 * Notifica o responsável (ou a equipe) e limpa o snooze para não repetir. Chamado pelo cron. Graceful.
 */
export async function dispararFollowupsVencidos(): Promise<{ disparados: number }> {
  const sb = createServiceClient();
  const agora = new Date().toISOString();
  const { data: vencidas } = await sb.from("rel_conversas")
    .select("id, org_id, assunto, assigned_to, snooze_until, status")
    .not("snooze_until", "is", null)
    .lte("snooze_until", agora)
    .neq("status", "arquivada")
    .is("deleted_at", null)
    .limit(200);

  let disparados = 0;
  for (const c of vencidas ?? []) {
    await notify({ orgId: c.org_id, userId: c.assigned_to ?? null, tipo: "followup_vencido", conversaId: c.id, titulo: `Follow-up vencido: ${c.assunto ?? "conversa"}` });
    await sb.from("rel_conversas").update({ snooze_until: null, updated_at: agora }).eq("id", c.id);
    disparados++;
  }
  return { disparados };
}
