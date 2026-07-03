import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente service_role — SOMENTE servidor (route handlers, server actions, páginas públicas).
 * Ignora RLS. Usado pela página pública da proposta (/p/[token]) e pelo adapter WhatsApp,
 * onde não há sessão autenticada. Nunca importar em componentes client.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
