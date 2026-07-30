import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Registra ação sensível no audit_logs (hash encadeado é calculado por trigger no banco).
 *
 * O erro é LOGADO, não descartado. Esta função descartava o retorno do insert, e foi por isso
 * que a trilha de auditoria ficou 100% morta por dias sem ninguém perceber: a migration 028
 * fixou o search_path de fn_audit_hash sem `extensions`, o digest() do pgcrypto ficou
 * inalcançável, e todo insert passou a falhar em silêncio. Nunca mais em silêncio.
 *
 * Não lança: uma falha de auditoria não deve derrubar a ação do usuário. Mas grita no log.
 */
export async function audit(action: string, resource: string, resourceId?: string, payload?: unknown, orgId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("audit_logs").insert({
    org_id: orgId ?? null,
    actor_id: user?.id ?? null,
    action, resource,
    resource_id: resourceId ?? null,
    payload: payload ?? null,
    hash: "pending", // sobrescrito pela trigger fn_audit_hash
  });
  if (error) console.error(`[AUDITORIA FALHOU] ${action} em ${resource}: ${error.message}`);
}

/**
 * Auditoria em contexto sem sessão (página pública /p/[token], webhooks).
 * Usa service_role — RLS não se aplica. actor_id normalmente null (ação do cliente/sistema).
 */
export async function auditService(action: string, resource: string, resourceId?: string, payload?: unknown, orgId?: string, actorId?: string) {
  const sb = createServiceClient();
  const { error } = await sb.from("audit_logs").insert({
    org_id: orgId ?? null, actor_id: actorId ?? null,
    action, resource, resource_id: resourceId ?? null,
    payload: payload ?? null, hash: "pending",
  });
  if (error) console.error(`[AUDITORIA FALHOU] ${action} em ${resource}: ${error.message}`);
}
