import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import type { NotifTipo } from "./types";

/**
 * Notificação in-app do Relacionamento (E0) — base para e-mail/push depois. Graceful.
 * userId null = para toda a equipe. Nunca quebra o fluxo que a dispara.
 */
export async function notify(opts: { orgId: string; userId?: string | null; tipo: NotifTipo; conversaId?: string | null; titulo?: string; payload?: Record<string, unknown> }) {
  try {
    await createServiceClient().from("rel_notificacoes").insert({
      org_id: opts.orgId, user_id: opts.userId ?? null, tipo: opts.tipo,
      conversa_id: opts.conversaId ?? null, titulo: opts.titulo ?? null, payload: opts.payload ?? {},
    });
  } catch { /* notificação nunca derruba o fluxo principal */ }
}

/** Nº de notificações não lidas do membro atual (as dele + as da equipe). Para o cockpit Hoje. */
export async function countNotificacoes(): Promise<number> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin || !m.userId) return 0;
  const { count } = await createServiceClient()
    .from("rel_notificacoes").select("id", { count: "exact", head: true })
    .eq("lida", false).or(`user_id.eq.${m.userId},user_id.is.null`);
  return count ?? 0;
}

/** Marca notificações como lidas (todas do membro, ou uma específica). */
export async function marcarLidas(id?: string) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin || !m.userId) return;
  const sb = createServiceClient();
  let q = sb.from("rel_notificacoes").update({ lida: true }).eq("lida", false);
  if (id) q = q.eq("id", id);
  else q = q.or(`user_id.eq.${m.userId},user_id.is.null`);
  await q;
}
