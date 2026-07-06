import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Integração Calendly ativa? (token de webhook definido) */
export function calendlyConfigured(): boolean {
  return !!process.env.CALENDLY_WEBHOOK_TOKEN;
}
/** Integração Read AI ativa? (token de webhook definido) */
export function readaiConfigured(): boolean {
  return !!process.env.READAI_WEBHOOK_TOKEN;
}

/**
 * Resolve a org de um cliente a partir do e-mail do participante:
 * localiza o usuário em auth.users e retorna a org da qual ele é membro (não-Salestrack).
 * Retorna null se não encontrar — o webhook então apenas registra em auditoria (modo degradado).
 */
export async function resolveOrgByEmail(email: string): Promise<string | null> {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const admin = createAdminClient();
  let userId: string | null = null;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const hit = data.users.find((u) => u.email?.toLowerCase() === norm);
    if (hit) { userId = hit.id; break; }
    if (data.users.length < 200) break;
  }
  if (!userId) return null;
  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  return m?.org_id ?? null;
}
