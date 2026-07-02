import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com service_role — SOMENTE servidor (server actions / route handlers / server components).
 * Nunca importar em componentes client. Ignora RLS: use com escopo restrito.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type UserInfo = { email: string | null; mfa: boolean };

/** Varre auth.users (páginas de 200) e retorna e-mail + status de MFA por id. */
async function scanUsers(): Promise<Record<string, UserInfo>> {
  const admin = createAdminClient();
  const out: Record<string, UserInfo> = {};
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      const factors = (u as { factors?: { status?: string; factor_type?: string }[] }).factors ?? [];
      out[u.id] = { email: u.email ?? null, mfa: factors.some((f) => f.status === "verified") };
    }
    if (data.users.length < 200) break;
    page++;
  }
  return out;
}

/** Mapa actor_id -> e-mail (para feeds e auditoria). */
export async function emailMap(ids: (string | null)[]): Promise<Record<string, string>> {
  if (ids.filter(Boolean).length === 0) return {};
  const all = await scanUsers();
  const map: Record<string, string> = {};
  for (const [id, info] of Object.entries(all)) if (info.email) map[id] = info.email;
  return map;
}

/** Info completa (e-mail + MFA) por id — usado na tela de Equipe. */
export async function usersInfo(): Promise<Record<string, UserInfo>> {
  return scanUsers();
}
