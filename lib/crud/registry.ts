/** Registro central de recursos do CRUD kit — resolve `name` (string do client) → ResourceDef. */
import type { ResourceDef } from "./types";
import { signalsResource } from "./resources/signals";
import { programaResource } from "./resources/programa";
import { ofertaResource } from "./resources/oferta";

const ALL: ResourceDef[] = [signalsResource as ResourceDef, programaResource as ResourceDef, ofertaResource as ResourceDef];

const BY_NAME: Record<string, ResourceDef> = Object.fromEntries(ALL.map((r) => [r.name, r]));

export function getResource(name: string): ResourceDef {
  const r = BY_NAME[name];
  if (!r) throw new Error(`Recurso desconhecido: ${name}`);
  return r;
}
