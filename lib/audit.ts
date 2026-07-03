import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Registra ação sensível no audit_logs (hash encadeado é calculado por trigger no banco). */
export async function audit(action: string, resource: string, resourceId?: string, payload?: unknown, orgId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    org_id: orgId ?? null,
    actor_id: user?.id ?? null,
    action, resource,
    resource_id: resourceId ?? null,
    payload: payload ?? null,
    hash: "pending", // sobrescrito pela trigger fn_audit_hash
  });
}

/**
 * Auditoria em contexto sem sessão (página pública /p/[token], webhooks).
 * Usa service_role — RLS não se aplica. actor_id normalmente null (ação do cliente/sistema).
 */
export async function auditService(action: string, resource: string, resourceId?: string, payload?: unknown, orgId?: string, actorId?: string) {
  const sb = createServiceClient();
  await sb.from("audit_logs").insert({
    org_id: orgId ?? null, actor_id: actorId ?? null,
    action, resource, resource_id: resourceId ?? null,
    payload: payload ?? null, hash: "pending",
  });
}
