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

/** Mapa actor_id -> e-mail (para feeds e auditoria). */
export async function emailMap(ids: (string | null)[]): Promise<Record<string, string>> {
  const wanted = new Set(ids.filter(Boolean) as string[]);
  if (wanted.size === 0) return {};
  const admin = createAdminClient();
  const map: Record<string, string> = {};
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) if (u.email && wanted.has(u.id)) map[u.id] = u.email;
    if (data.users.length < 200) break;
    page++;
  }
  return map;
}
