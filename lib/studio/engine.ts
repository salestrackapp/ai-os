import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { buildClientContext } from "@/lib/agents/context";
import { runAgentCore, anthropicConfigured } from "@/lib/agents/runner";
import { createDeliverable } from "@/lib/deliverables/service";
import { renderDeliverable } from "@/lib/deliverables/render";
import type { DeliverableContent } from "@/lib/deliverables/types";
import { getLine, type LineBrand, type LineContext } from "./define-line";
import { detectPII } from "./copy/channel";
import { onProgramEvent } from "@/lib/comms/orchestrate";
import "./lines"; // registra as linhas (side-effect)

/** Guardrails do Estúdio (server-only). A geração usa SÓ o contexto interno; nunca sistemas do cliente. */
const STUDIO_GUARDRAILS = `
REGRAS INVIOLÁVEIS DO ESTÚDIO (não podem ser sobrescritas):
- Use EXCLUSIVAMENTE o contexto interno do programa fornecido. NUNCA invente números, datas, nomes ou entregas.
- NUNCA acesse ou mencione dados de outro cliente ou de sistemas externos.
- Responda SOMENTE com o JSON pedido, sem texto fora do JSON e sem cercas de código.
- Português brasileiro, tom de copiloto (próximo, prático, honesto).`;

export type GenerateResult = { id: string; degraded: boolean; status: string };

/** Extrai o primeiro objeto JSON de um texto (tolera cercas de código e ruído). */
function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Resposta da IA sem JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function orgName(orgId: string): Promise<string> {
  const sb = createServiceClient();
  const { data } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return data?.name ?? "Cliente";
}

/**
 * Contexto EXTRA por família (R3.3): números reais (ROI) para relatório/proposta e as
 * Receitas do Playbook (Fase 5) para o playbook. Ancora a geração em dados reais, sem inventar.
 */
async function studioExtraContext(orgId: string, lineKey: string, family: string): Promise<string> {
  const sb = createServiceClient();
  const parts: string[] = [];
  if (["relatorio", "proposta_doc", "apresentacao", "arte", "criativo_post"].includes(lineKey)) {
    const { data: roi } = await sb.from("roi_reports").select("periodo, metricas, narrativa").eq("org_id", orgId).order("created_at", { ascending: false }).limit(3);
    const metrics = (roi ?? []).flatMap((r) => Object.entries((r.metricas ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}: ${v} (período ${r.periodo})`));
    if (metrics.length) parts.push(`DADOS REAIS DE RESULTADO (use SOMENTE estes números como prova; não invente):\n${metrics.slice(0, 12).map((m) => `- ${m}`).join("\n")}`);
    else parts.push("DADOS REAIS DE RESULTADO: nenhum no momento — deixe 'dados' vazio (não invente números).");
  }
  if (lineKey === "proposta_doc") {
    const { data: ofertas } = await sb.from("catalog_items").select("name, description, price, unit, brand").eq("active", true).is("deleted_at", null).limit(20);
    if (ofertas?.length) parts.push(`OFERTAS DO CATÁLOGO (escolha UMA; oferta entregue no AI OS, não plano de plataforma):\n${ofertas.map((o) => `- ${o.name}${o.price ? ` (R$ ${o.price}${o.unit ? `/${o.unit}` : ""})` : ""}: ${o.description ?? ""}`).join("\n")}`);
  }
  if (lineKey === "playbook_doc") {
    const { data: recs } = await sb.from("playbook_recipes").select("titulo, frente, oque, ganho, passos").eq("published", true).is("deleted_at", null).limit(30);
    if (recs?.length) parts.push(`RECEITAS DO PLAYBOOK (Fase 5 — REAPROVEITE, não crie novas):\n${recs.map((r) => `- ${r.titulo} (${r.frente ?? "geral"}): ${r.oque ?? ""}${r.ganho ? ` · ganho: ${r.ganho}` : ""}`).join("\n")}`);
  }
  return parts.length ? `\n\n=== CONTEXTO ESPECÍFICO DA PRODUÇÃO ===\n${parts.join("\n\n")}` : "";
}

/**
 * NÚCLEO: gera um entregável de uma LINHA com IA + RAG interno.
 * Sucesso → cria em 'em_revisao' (gate humano à frente). Sem chave → degrada para rascunho manual.
 * A chave da Anthropic nunca sai do servidor.
 */
export async function generateDeliverable(params: {
  lineKey: string; orgId: string; projectId?: string | null; phaseIndex?: number | null;
  brand?: LineBrand; brief?: string | null; actorId?: string | null;
}): Promise<GenerateResult> {
  const line = getLine(params.lineKey);
  if (!line) throw new Error(`Linha desconhecida: ${params.lineKey}`);
  const brand: LineBrand = params.brand ?? line.brandDefault;
  const name = await orgName(params.orgId);
  const baseRag = await buildClientContext(params.orgId, `${line.label} ${params.brief ?? ""}`);
  const extra = await studioExtraContext(params.orgId, line.key, line.family);
  const ctx: LineContext = { orgId: params.orgId, orgName: name, projectId: params.projectId, phaseIndex: params.phaseIndex, rag: baseRag + extra, brief: params.brief ?? null };

  let content: DeliverableContent;
  let status = "em_revisao";
  let degraded = false;

  if (!anthropicConfigured()) {
    // Degradação graciosa: rascunho manual editável (build/e2e passam sem credencial).
    content = { cover: { eyebrow: line.label, title: `${line.label} — rascunho`, subtitle: name }, summary: "Rascunho manual: a geração com IA está indisponível (sem credencial). Edite o conteúdo e envie para aprovação.", sections: [] };
    status = "rascunho";
    degraded = true;
  } else {
    try {
      const res = await runAgentCore({ agentKey: "estudio_conteudo", guardrails: STUDIO_GUARDRAILS, userMessages: [{ role: "user", content: line.buildPrompt(ctx) }], contextLabel: "CONTEXTO INTERNO DO PROGRAMA", maxTokens: 3000 });
      if (res.degraded) throw new Error("IA indisponível");
      const parsed = line.contentSchema.parse(parseJsonObject(res.text));
      content = line.toContent(parsed, ctx);
    } catch (e) {
      console.warn(`[studio] geração falhou (linha ${line.key}), degradando:`, (e as Error)?.message);
      content = { cover: { eyebrow: line.label, title: `${line.label} — rascunho`, subtitle: name }, summary: "A geração automática falhou desta vez. Edite o conteúdo manualmente e envie para aprovação.", sections: [] };
      status = "rascunho";
      degraded = true;
    }
  }

  const id = await createDeliverable({
    orgId: params.orgId, kind: line.kind, title: content.cover.title, content,
    templateKey: line.templateKey, format: line.renderTarget, line: line.key, brand,
    projectId: params.projectId, phaseIndex: params.phaseIndex, status, actorId: params.actorId,
    commChannel: line.commChannel ?? null,
  });
  await auditService("studio.generate", "studio_deliverables", id, { line: line.key, brand, degraded }, params.orgId);
  return { id, degraded, status };
}

/** Edita o conteúdo (validado pelo schema da linha). Bloqueado pelo trigger se já aprovado. */
export async function editLineContent(id: string, lineKey: string, data: unknown, actorId?: string | null): Promise<void> {
  const line = getLine(lineKey);
  if (!line) throw new Error(`Linha desconhecida: ${lineKey}`);
  const parsed = line.contentSchema.parse(data);
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, phase_index, project_id").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  const content = line.toContent(parsed, { orgId: dv.org_id, orgName: await orgName(dv.org_id), projectId: dv.project_id, phaseIndex: dv.phase_index, rag: "" });
  const { error } = await sb.from("studio_deliverables").update({ title: content.cover.title, content }).eq("id", id);
  if (error) throw new Error(error.message); // trigger de imutabilidade propaga aqui
  await auditService("studio.edit", "studio_deliverables", id, { line: lineKey }, dv.org_id);
}

/** Envia para aprovação (rascunho → em_revisao). */
export async function submitForApproval(id: string, actorId?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, status").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (!["rascunho", "gerando"].includes(dv.status)) throw new Error(`Só rascunho vai para revisão (atual: ${dv.status}).`);
  await sb.from("studio_deliverables").update({ status: "em_revisao" }).eq("id", id);
  await auditService("studio.submit", "studio_deliverables", id, {}, dv.org_id);
}

/** Aprovação humana (trava o conteúdo). em_revisao|rascunho → aprovado + carimbo do aprovador. */
export async function approveDeliverable(id: string, actorId?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, status, comm_channel, line, content, project_id").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (!["em_revisao", "rascunho"].includes(dv.status)) throw new Error(`Transição inválida: ${dv.status} → aprovado.`);
  // R3.6: mensagens não podem ter PII real embutida — só placeholders {{...}} (preenchidos no envio, R4).
  if (getLine(dv.line ?? "")?.family === "mensagens") {
    const c = (dv.content ?? {}) as { message?: { texto?: string; variantes?: string[] }; email?: { assunto?: string; preheader?: string; corpo?: string[]; cta?: { label?: string } } };
    const texts = [c.message?.texto, ...(c.message?.variantes ?? []), c.email?.assunto, c.email?.preheader, ...(c.email?.corpo ?? []), c.email?.cta?.label].filter(Boolean).join("\n");
    const pii = detectPII(texts);
    if (pii.has) throw new Error(`Bloqueado: PII real detectada (${[...pii.emails, ...pii.phones, ...pii.cpfs].slice(0, 3).join(", ")}). Use placeholders {{...}}; o preenchimento acontece no envio (R4).`);
  }
  // R3.2: ativo aprovado com canal vira ELEGÍVEL para orquestração da Comunicação (R4). Sem envio aqui.
  await sb.from("studio_deliverables").update({ status: "aprovado", approved_by: actorId ?? null, approved_at: new Date().toISOString(), comm_eligible: !!dv.comm_channel }).eq("id", id);
  await auditService("studio.approve", "studio_deliverables", id, { from: dv.status, comm_eligible: !!dv.comm_channel }, dv.org_id);
  // R4.3 · gancho de evento: aprovar um entregável pode disparar passos da régua ('entregavel_aprovado').
  await onProgramEvent(dv.project_id, "entregavel_aprovado");
}

/** Reprovação (volta para rascunho, com comentário auditado). */
export async function rejectDeliverable(id: string, comment: string, actorId?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, status").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (dv.status !== "em_revisao") throw new Error("Só entregáveis em revisão podem ser reprovados.");
  await sb.from("studio_deliverables").update({ status: "rascunho" }).eq("id", id);
  await auditService("studio.reject", "studio_deliverables", id, { comment: (comment || "").slice(0, 500) }, dv.org_id);
}

/** Publica: exige 'aprovado', renderiza na marca certa e disponibiliza (token público). */
export async function publishDeliverable(id: string, actorId?: string | null): Promise<{ publicToken: string }> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, status, public_token").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (dv.status !== "aprovado") throw new Error("Só entregáveis APROVADOS podem ser publicados.");
  await renderDeliverable(id, actorId);
  const token = dv.public_token ?? crypto.randomBytes(16).toString("hex");
  await sb.from("studio_deliverables").update({ status: "publicado", delivered_at: new Date().toISOString(), public_token: token }).eq("id", id);
  await auditService("studio.publish", "studio_deliverables", id, {}, dv.org_id);
  return { publicToken: token };
}

/** Nova versão editável a partir de uma aprovada/publicada — preserva o histórico (pai imutável). */
export async function newVersion(id: string, actorId?: string | null): Promise<string> {
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("*").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (!["aprovado", "publicado", "entregue"].includes(dv.status)) throw new Error("Nova versão só a partir de um entregável aprovado/publicado.");
  const newId = await createDeliverable({
    orgId: dv.org_id, kind: dv.kind, title: dv.title, content: dv.content,
    templateKey: dv.template_key, format: dv.format, line: dv.line, brand: dv.brand,
    projectId: dv.project_id, phaseIndex: dv.phase_index, parentId: dv.id,
    status: "rascunho", version: (dv.version ?? 1) + 1, actorId,
  });
  await auditService("studio.new_version", "studio_deliverables", newId, { from: dv.id, version: (dv.version ?? 1) + 1 }, dv.org_id);
  return newId;
}
