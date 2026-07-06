"use server";
/**
 * Factory de server actions do CRUD kit. A partir do `name` do recurso, gera
 * create/update/remove(soft)/restore/hardDelete/duplicate — cada um VALIDA (zod),
 * CHECA PERMISSÃO no servidor, executa sob RLS e AUDITA. Erros viram mensagens amigáveis.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getResource } from "./registry";
import { duplicateCopy, type Actor, type CrudOp, type ResourceDef } from "./types";

export type CrudResult = { ok: boolean; id?: string; message: string };

async function actorOf(): Promise<Actor> {
  const m = await currentMembership();
  return { isSalestrackAdmin: !!m?.isSalestrackAdmin, orgId: m?.orgId ?? null, userId: m?.userId ?? null };
}
function ensure(def: ResourceDef, actor: Actor, op: CrudOp) {
  if (!def.permission(actor, op)) throw new Error("Você não tem permissão para esta ação.");
}
function revalidate(def: ResourceDef) { for (const p of def.revalidate) revalidatePath(p); }

/** Monta o objeto a partir do FormData conforme os tipos dos campos + valida com o schema. */
function parse(def: ResourceDef, formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.type === "boolean") raw[f.name] = formData.get(f.name) != null;
    else raw[f.name] = formData.get(f.name);
  }
  try {
    return def.schema.parse(raw) as Record<string, unknown>;
  } catch (e) {
    const msg = (e as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Confira os campos e tente de novo.";
    throw new Error(msg);
  }
}

export async function crudCreate(name: string, formData: FormData): Promise<CrudResult> {
  try {
    const def = getResource(name); const actor = await actorOf(); ensure(def, actor, "create");
    const data = parse(def, formData);
    if (def.orgScoped) data.org_id = actor.orgId;
    const sb = await createClient();
    const { data: row, error } = await sb.from(def.table).insert(data).select("id").single();
    if (error) throw new Error(error.message);
    await audit(`${def.name}.create`, def.table, row.id, { data }, def.orgScoped ? actor.orgId ?? undefined : undefined);
    revalidate(def);
    return { ok: true, id: row.id as string, message: def.labels.created };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function crudUpdate(name: string, id: string, formData: FormData): Promise<CrudResult> {
  try {
    const def = getResource(name); const actor = await actorOf(); ensure(def, actor, "update");
    const data = parse(def, formData);
    const sb = await createClient();
    const { error } = await sb.from(def.table).update(data).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(`${def.name}.update`, def.table, id, { data });
    revalidate(def);
    return { ok: true, id, message: def.labels.updated };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function crudRemove(name: string, id: string): Promise<CrudResult> {
  try {
    const def = getResource(name); const actor = await actorOf(); ensure(def, actor, "delete");
    const sb = await createClient();
    if (def.softDelete) {
      const { error } = await sb.from(def.table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from(def.table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    }
    await audit(`${def.name}.remove`, def.table, id, { soft: def.softDelete });
    revalidate(def);
    return { ok: true, id, message: def.labels.removed };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function crudRestore(name: string, id: string): Promise<CrudResult> {
  try {
    const def = getResource(name); const actor = await actorOf(); ensure(def, actor, "restore");
    if (!def.softDelete) throw new Error("Este recurso não guarda itens excluídos.");
    const sb = await createClient();
    const { error } = await sb.from(def.table).update({ deleted_at: null }).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(`${def.name}.restore`, def.table, id);
    revalidate(def);
    return { ok: true, id, message: def.labels.restored };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function crudHardDelete(name: string, id: string): Promise<CrudResult> {
  try {
    const def = getResource(name); const actor = await actorOf(); ensure(def, actor, "delete");
    const sb = await createClient();
    if (def.softDelete) {
      // Exige que já esteja na lixeira (soft-deleted) — evita destruição acidental de item vivo.
      const { data: cur } = await sb.from(def.table).select("deleted_at").eq("id", id).maybeSingle();
      if (!cur?.deleted_at) throw new Error("Exclua primeiro (fica recuperável) e só então exclua permanentemente.");
    }
    const { error } = await sb.from(def.table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    await audit(`${def.name}.hard_delete`, def.table, id);
    revalidate(def);
    return { ok: true, id, message: `${def.singular} excluído permanentemente.` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function crudDuplicate(name: string, id: string): Promise<CrudResult> {
  try {
    const def = getResource(name); const actor = await actorOf(); ensure(def, actor, "duplicate");
    const sb = await createClient();
    const { data: row, error: e1 } = await sb.from(def.table).select("*").eq("id", id).single();
    if (e1 || !row) throw new Error("Item não encontrado para duplicar.");
    const copy = duplicateCopy(def, row);
    const { data: created, error: e2 } = await sb.from(def.table).insert(copy).select("id").single();
    if (e2) throw new Error(e2.message);
    await audit(`${def.name}.duplicate`, def.table, created.id, { from: id });
    revalidate(def);
    return { ok: true, id: created.id as string, message: def.labels.duplicated };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
