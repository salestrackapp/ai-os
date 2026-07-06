import "server-only";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { getResource } from "./registry";
import type { Actor, CrudOp } from "./types";

/** Lista as linhas VIVAS (ou a lixeira) de um recurso, respeitando RLS + org + soft delete. */
export async function listResource<Row = Record<string, unknown>>(name: string, opts?: { trash?: boolean }): Promise<Row[]> {
  const def = getResource(name);
  const sb = await createClient();
  let q = sb.from(def.table).select("*");
  if (def.orgScoped) { const m = await currentMembership(); if (m?.orgId) q = q.eq("org_id", m.orgId); }
  if (def.softDelete) q = opts?.trash ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (def.orderBy) q = q.order(def.orderBy.column, { ascending: def.orderBy.ascending ?? true });
  const { data } = await q;
  return (data ?? []) as Row[];
}

/** Permissões efetivas do usuário atual para um recurso (para a UI esconder/desabilitar ações). */
export async function resourcePermissions(name: string): Promise<Record<CrudOp, boolean>> {
  const def = getResource(name);
  const m = await currentMembership();
  const actor: Actor = { isSalestrackAdmin: !!m?.isSalestrackAdmin, orgId: m?.orgId ?? null, userId: m?.userId ?? null };
  return {
    create: def.permission(actor, "create"), update: def.permission(actor, "update"),
    delete: def.permission(actor, "delete"), duplicate: def.permission(actor, "duplicate"),
    restore: def.permission(actor, "restore"),
  };
}
