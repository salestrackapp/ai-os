import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Membership = { userId: string; email: string | null; isSalestrackAdmin: boolean; orgId: string | null; role: string | null };

/**
 * Guarda das Server Actions do admin.
 *
 * ── Por que a action precisa de guarda própria ────────────────────────────────────────────────
 * Toda função async exportada de um arquivo `"use server"` é um endpoint POST. A página que a
 * renderiza não protege coisa nenhuma: quem tiver o identificador da action a chama direto, sem
 * nunca abrir a tela. A guarda mora DENTRO da função ou não existe.
 *
 * ── E a RLS não basta, mesmo quando basta ─────────────────────────────────────────────────────
 * Hoje a RLS realmente barra: escrever em `invoices`, `contacts`, `organizations` e `tasks` exige
 * `is_salestrack_admin()` no banco. Só que depender só disso deixa a segurança de uma action à
 * mercê de uma política que alguém pode afrouxar no futuro por outro motivo — "deixar o
 * client_admin editar os contatos da própria empresa" é um pedido razoável que abriria todas essas
 * actions de uma vez. Com a guarda local, afrouxar a política não basta para abrir a action.
 *
 * Falha com exceção, e não com retorno silencioso: chamada não autorizada tem de aparecer no log.
 */
export async function exigirAdmin(): Promise<Membership> {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas a equipe Salestrack.");
  return m;
}

/** Resolve o usuário atual e sua membership principal (para roteamento e isolamento). */
export async function currentMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: mems } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(is_salestrack)")
    .eq("user_id", user.id);
  type Row = { org_id: string; role: string; organizations: { is_salestrack: boolean } | { is_salestrack: boolean }[] | null };
  const rows = (mems ?? []) as unknown as Row[];
  const isSt = (o: Row["organizations"]) => (Array.isArray(o) ? o[0]?.is_salestrack : o?.is_salestrack) ?? false;
  const adminRow = rows.find((m) => m.role === "salestrack_admin" && isSt(m.organizations));
  if (adminRow) return { userId: user.id, email: user.email ?? null, isSalestrackAdmin: true, orgId: adminRow.org_id, role: "salestrack_admin" };
  const clientRow = rows.find((m) => !isSt(m.organizations));
  if (clientRow) return { userId: user.id, email: user.email ?? null, isSalestrackAdmin: false, orgId: clientRow.org_id, role: clientRow.role };
  return { userId: user.id, email: user.email ?? null, isSalestrackAdmin: false, orgId: null, role: null };
}
