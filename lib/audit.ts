import { createClient } from "@/lib/supabase/server";

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
