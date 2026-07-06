/**
 * CRUD kit · contrato de recurso (Salestrack AI v2).
 * Uma tela vira CRUD completo apenas DECLARANDO um recurso (defineResource) e plugando os
 * componentes do kit. Módulo NEUTRO (data + zod + funções puras) — importável por client e server.
 */
import type { ZodType } from "zod";

export type FieldType = "text" | "number" | "boolean" | "textarea" | "select";

export type FieldDef = {
  name: string; label: string; type: FieldType;
  required?: boolean; help?: string; placeholder?: string;
  default?: string | number | boolean; min?: number; max?: number; step?: number;
  options?: { value: string; label: string }[];   // para type 'select'
};

export type ColumnDef<Row> = {
  key: string; header: string; align?: "left" | "right" | "center";
  render?: (row: Row) => React.ReactNode; mono?: boolean;
};

/** Papel resolvido no servidor, passado para a checagem de permissão. */
export type Actor = { isSalestrackAdmin: boolean; orgId: string | null; userId: string | null };
export type CrudOp = "create" | "update" | "delete" | "duplicate" | "restore";

export type ResourceLabels = {
  created: string; updated: string; removed: string; restored: string; duplicated: string;
  confirmDeleteTitle: string; confirmDeleteBody: string;
};

export type ResourceDef<Row extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;                 // id do recurso (ex.: 'signals')
  table: string;                // tabela no banco
  singular: string; plural: string;   // rótulos em PT
  schema: ZodType;              // validação compartilhada cliente+servidor
  fields: FieldDef[];           // geram o ResourceForm
  columns: ColumnDef<Row>[];    // geram o DataTable
  orgScoped: boolean;           // grava/filtra por org_id?
  softDelete: boolean;          // usa deleted_at?
  orderBy?: { column: string; ascending?: boolean };
  searchKeys?: string[];        // campos usados na busca da tabela
  duplicate?: { suffixField?: string; suffix?: string; clear?: string[] };  // como clonar
  permission: (actor: Actor, op: CrudOp) => boolean;
  revalidate: string[];         // rotas a revalidar após escrita
  labels: ResourceLabels;
};

export function defineResource<Row extends Record<string, unknown>>(def: ResourceDef<Row>): ResourceDef<Row> {
  return def;
}

/** Clona uma linha aplicando o transform do recurso (sufixo, limpar campos, dropar id/timestamps). Puro. */
export function duplicateCopy(def: { duplicate?: { suffixField?: string; suffix?: string; clear?: string[] } }, row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row };
  delete copy.id; delete copy.created_at; delete copy.deleted_at;
  const d = def.duplicate;
  if (d?.suffixField && d.suffix && typeof copy[d.suffixField] === "string") copy[d.suffixField] = `${copy[d.suffixField]}${d.suffix}`;
  for (const c of d?.clear ?? []) delete copy[c];
  return copy;
}
