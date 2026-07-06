import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

/**
 * Instancia a régua-template padrão para um programa (cópia editável, sem asset_ref).
 * Idempotente: se o programa já tem régua, retorna a existente. Chamado no provisionamento (Fase 8).
 */
export async function instantiateReguaForProgram(projectId: string, orgId: string | null, actorId?: string | null): Promise<string | null> {
  const sb = createServiceClient();
  const { data: exists } = await sb.from("regua").select("id").eq("scope", "program").eq("ref_id", projectId).is("deleted_at", null).limit(1).maybeSingle();
  if (exists) return exists.id;
  const { data: tpl } = await sb.from("regua").select("id, nome").eq("scope", "program_template").is("deleted_at", null).order("created_at").limit(1).maybeSingle();
  if (!tpl) return null;
  const { data: tplSteps } = await sb.from("regua_step").select("cycle_step, titulo, gatilho, asset_type, timing, publico, ordem, ativo").eq("regua_id", tpl.id).is("deleted_at", null);
  const { data: reg } = await sb.from("regua").insert({ org_id: orgId, scope: "program", ref_id: projectId, nome: tpl.nome, created_by: actorId ?? null }).select("id").single();
  if (reg && tplSteps?.length) await sb.from("regua_step").insert(tplSteps.map((s) => ({ ...s, regua_id: reg.id, asset_ref: null })));
  await auditService("regua.instantiate", "regua", reg?.id, { from_template: tpl.id, project: projectId }, orgId ?? undefined);
  return reg?.id ?? null;
}
