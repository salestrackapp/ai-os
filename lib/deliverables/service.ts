import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { renderDeliverable } from "./render";
import { composeProposal, composeRoi, composeDossie, composeFrente, composeSessao } from "./compose";
import type { DeliverableContent, DeliverableFormat, DeliverableKind } from "./types";

/** Template padrão por kind (seed do Bloco 3). */
export const DEFAULT_TEMPLATE: Record<DeliverableKind, { key: string; format: DeliverableFormat }> = {
  proposta: { key: "proposta_executiva", format: "pdf" },
  roi: { key: "roi_mensal", format: "pdf" },
  dossie: { key: "dossie_prospect", format: "pdf" },
  relatorio_frente: { key: "relatorio_frente", format: "pdf" },
  resumo_sessao: { key: "resumo_sessao", format: "pdf" },
  one_pager: { key: "one_pager", format: "pdf" },
  apresentacao: { key: "apresentacao_exec", format: "pptx" },
};

type SourceType = "roi_narrative" | "prospect" | "deal" | "project" | "session" | "manual";

export async function createDeliverable(params: {
  orgId: string; kind: DeliverableKind; title: string; content: DeliverableContent;
  sourceType?: SourceType; sourceId?: string | null; templateKey?: string; format?: DeliverableFormat; actorId?: string | null;
  // R3.1 · motor do Estúdio
  line?: string | null; brand?: string | null; projectId?: string | null; phaseIndex?: number | null;
  parentId?: string | null; status?: string; version?: number; commChannel?: string | null;
}): Promise<string> {
  const sb = createServiceClient();
  const def = DEFAULT_TEMPLATE[params.kind];
  const row = {
    org_id: params.orgId, kind: params.kind, title: params.title, content: params.content,
    source_type: params.sourceType ?? "manual", source_id: params.sourceId ?? null,
    template_key: params.templateKey ?? def.key, format: params.format ?? def.format,
    status: params.status ?? "rascunho", version: params.version ?? 1, created_by: params.actorId ?? null,
    line: params.line ?? null, brand: params.brand ?? "salestrack",
    project_id: params.projectId ?? null, phase_index: params.phaseIndex ?? null, parent_id: params.parentId ?? null,
    comm_channel: params.commChannel ?? null,
  };
  const { data, error } = await sb.from("studio_deliverables").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await auditService("deliverable.create", "studio_deliverables", data.id, { kind: params.kind, source: row.source_type, line: row.line, brand: row.brand }, params.orgId);
  return data.id as string;
}

/** Gera um entregável a partir de uma origem do AI OS (compõe o conteúdo e cria em rascunho). */
export async function generateFromSource(kind: DeliverableKind, sourceId: string, actorId?: string | null): Promise<string> {
  let composed: { orgId: string | null; title: string; content: DeliverableContent };
  let sourceType: SourceType;
  if (kind === "proposta") { composed = await composeProposal(sourceId); sourceType = "deal"; }
  else if (kind === "roi") { composed = await composeRoi(sourceId); sourceType = "roi_narrative"; }
  else if (kind === "dossie" || kind === "one_pager") { composed = await composeDossie(sourceId); sourceType = "prospect"; }
  else if (kind === "relatorio_frente") { composed = await composeFrente(sourceId); sourceType = "project"; }
  else if (kind === "resumo_sessao") { composed = await composeSessao(sourceId); sourceType = "session"; }
  else throw new Error(`Origem não suportada para o tipo ${kind}.`);

  // Dossiê/one-pager de prospect são artefatos INTERNOS da Salestrack → viram da org Salestrack.
  let orgId = composed.orgId;
  if (!orgId) {
    const sb = createServiceClient();
    const { data: st } = await sb.from("organizations").select("id").eq("is_salestrack", true).limit(1).maybeSingle();
    if (!st) throw new Error("Org Salestrack não encontrada para hospedar o artefato interno.");
    orgId = st.id as string;
  }
  return createDeliverable({ orgId: orgId!, kind, title: composed.title, content: composed.content, sourceType, sourceId, actorId });
}

const NEXT: Record<string, string[]> = {
  rascunho: ["gerando", "em_revisao", "aprovado"],
  gerando: ["em_revisao", "rascunho"],
  em_revisao: ["aprovado", "rascunho"],
  aprovado: ["publicado", "entregue", "em_revisao"],
  publicado: ["aprovado"],
  entregue: ["aprovado"],
};

/** Transição de estado do portão de aprovação (auditada). */
export async function setDeliverableStatus(id: string, status: string, actorId?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("status, org_id, kind").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (!NEXT[dv.status]?.includes(status)) throw new Error(`Transição inválida: ${dv.status} → ${status}.`);
  await sb.from("studio_deliverables").update({ status }).eq("id", id);
  await auditService(`deliverable.${status}`, "studio_deliverables", id, { from: dv.status }, dv.org_id);
}

/** Entrega: exige status 'aprovado', gera token público e re-renderiza se preciso. */
export async function deliverDeliverable(id: string, actorId?: string | null): Promise<{ publicToken: string }> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("status, org_id, rendered_url, public_token").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (dv.status !== "aprovado") throw new Error("Só entregáveis APROVADOS podem ser entregues.");
  if (!dv.rendered_url) await renderDeliverable(id, actorId);
  const token = dv.public_token ?? crypto.randomBytes(16).toString("hex");
  await sb.from("studio_deliverables").update({ status: "entregue", delivered_at: new Date().toISOString(), public_token: token }).eq("id", id);
  await auditService("deliverable.deliver", "studio_deliverables", id, {}, dv.org_id);
  return { publicToken: token };
}

/** Re-render explícito: nova versão imutável (permitido mesmo em proposta aprovada — só formatação). */
export async function rerenderDeliverable(id: string, actorId?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("version, status").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  await sb.from("studio_deliverables").update({ version: (dv.version ?? 1) + 1 }).eq("id", id);
  await renderDeliverable(id, actorId);
}

/** Edita conteúdo/título do rascunho (bloqueado em proposta aprovada pelo trigger). */
export async function updateDeliverableContent(id: string, patch: { title?: string; content?: DeliverableContent }, actorId?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  const upd: Record<string, unknown> = {};
  if (patch.title != null) upd.title = patch.title;
  if (patch.content != null) upd.content = patch.content;
  const { error } = await sb.from("studio_deliverables").update(upd).eq("id", id);
  if (error) throw new Error(error.message);
  await auditService("deliverable.edit", "studio_deliverables", id, {}, dv.org_id);
}
