"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentMembership } from "@/lib/auth";
import {
  createDeliverable, generateFromSource, setDeliverableStatus, deliverDeliverable,
  rerenderDeliverable, updateDeliverableContent,
} from "@/lib/deliverables/service";
import { renderDeliverable, signedArtifactUrl } from "@/lib/deliverables/render";
import { htmlToPdf } from "@/lib/deliverables/render/pdf";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { generateDeliverable, approveDeliverable, rejectDeliverable, publishDeliverable, submitForApproval, newVersion } from "@/lib/studio/engine";
import { buildCertificateHtml } from "@/lib/studio/render/certificate";
import { composeFormacaoDeck } from "@/lib/studio/lines/formacao";
import { creativeFromPost } from "@/lib/studio/lines/arte";
import { renderCreativePngs } from "@/lib/studio/render/creative-png";
import { triggerVideoRender } from "@/lib/studio/video/render-tool";
import { sendOne } from "@/lib/comms/send";
import type { LineBrand } from "@/lib/studio/define-line";
import type { DeliverableKind, DeliverableContent } from "@/lib/deliverables/types";

const FORMACAO_TIPOS = ["palestra", "workshop", "treinamento", "curso"];

/** Identidade ativa do programa (accent/logo/nome) — para certificado/slides. */
async function programIdentity(projectId?: string | null) {
  if (!projectId) return { accent: null as string | null, logo: null as string | null, programName: null as string | null };
  const sb = createServiceClient();
  const { data } = await sb.from("programa_identidade").select("accent, client_logo, program_name").eq("program_id", projectId).eq("active", true).is("deleted_at", null).maybeSingle();
  return { accent: data?.accent ?? null, logo: data?.client_logo ?? null, programName: data?.program_name ?? null };
}

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

export async function generateAction(kind: string, sourceId: string) {
  const m = await requireAdmin();
  const id = await generateFromSource(kind as DeliverableKind, sourceId, m.userId);
  await renderDeliverable(id, m.userId).catch(() => null);
  redirect(`/admin/entregaveis/${id}`);
}

export async function createManualAction(formData: FormData) {
  const m = await requireAdmin();
  const orgId = String(formData.get("org_id") ?? "");
  const kind = String(formData.get("kind") ?? "one_pager") as DeliverableKind;
  const title = String(formData.get("title") ?? "Novo entregável");
  const summary = String(formData.get("summary") ?? "");
  if (!orgId) throw new Error("Escolha a organização.");
  const id = await createDeliverable({
    orgId, kind, title, sourceType: "manual", actorId: m.userId,
    content: { cover: { title }, summary: summary || undefined, sections: [] },
  });
  redirect(`/admin/entregaveis/${id}`);
}

export async function statusAction(id: string, status: string) {
  const m = await requireAdmin();
  await setDeliverableStatus(id, status, m.userId);
  revalidatePath(`/admin/entregaveis/${id}`);
}

export async function deliverAction(id: string) {
  const m = await requireAdmin();
  await deliverDeliverable(id, m.userId);
  revalidatePath(`/admin/entregaveis/${id}`);
}

export async function rerenderAction(id: string) {
  const m = await requireAdmin();
  await rerenderDeliverable(id, m.userId);
  revalidatePath(`/admin/entregaveis/${id}`);
}

export async function saveContentAction(id: string, formData: FormData) {
  const m = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const raw = String(formData.get("content_json") ?? "").trim();
  let content;
  if (raw) { try { content = JSON.parse(raw); } catch { throw new Error("JSON de conteúdo inválido."); } }
  await updateDeliverableContent(id, { title: title || undefined, content }, m.userId);
  await renderDeliverable(id, m.userId).catch(() => null);
  revalidatePath(`/admin/entregaveis/${id}`);
}

// ── R3.1 · Motor do Estúdio (linhas de produção) ──

/** Gera um entregável de uma LINHA com IA + RAG interno; abre no rascunho/revisão. */
export async function generateLineAction(formData: FormData) {
  const m = await requireAdmin();
  const lineKey = String(formData.get("line") ?? "");
  const orgId = String(formData.get("org_id") ?? "");
  const brand = (String(formData.get("brand") ?? "") || undefined) as LineBrand | undefined;
  const brief = String(formData.get("brief") ?? "").trim() || null;
  if (!lineKey || !orgId) throw new Error("Escolha a linha e a organização.");
  const { id } = await generateDeliverable({ lineKey, orgId, brand, brief, actorId: m.userId });
  redirect(`/admin/entregaveis/${id}`);
}

export async function submitStudioAction(id: string) {
  const m = await requireAdmin();
  await submitForApproval(id, m.userId);
  revalidatePath("/admin/entregaveis"); revalidatePath(`/admin/entregaveis/${id}`);
}
export async function approveStudioAction(id: string) {
  const m = await requireAdmin();
  await approveDeliverable(id, m.userId);
  revalidatePath("/admin/entregaveis"); revalidatePath(`/admin/entregaveis/${id}`);
}
export async function rejectStudioAction(id: string, formData: FormData) {
  const m = await requireAdmin();
  await rejectDeliverable(id, String(formData.get("comment") ?? ""), m.userId);
  revalidatePath("/admin/entregaveis"); revalidatePath(`/admin/entregaveis/${id}`);
}
export async function publishStudioAction(id: string) {
  const m = await requireAdmin();
  await publishDeliverable(id, m.userId);
  revalidatePath("/admin/entregaveis"); revalidatePath(`/admin/entregaveis/${id}`);
}
export async function newVersionStudioAction(id: string) {
  const m = await requireAdmin();
  const newId = await newVersion(id, m.userId);
  redirect(`/admin/entregaveis/${newId}`);
}

/**
 * R3.3 · Proposta do Estúdio → Comercial. Cria uma proposta no funil existente a partir de uma
 * proposta APROVADA (linha proposta_doc). Fechar no Comercial dispara o provisionamento (Fase 8).
 * Modelo corrigido: oferta entregue no AI OS, sem plano/assinatura de plataforma.
 */
export async function enviarPropostaAoComercialAction(id: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("id, org_id, title, line, status, content").eq("id", id).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  if (dv.line !== "proposta_doc") throw new Error("Só propostas podem ir ao Comercial.");
  if (dv.status !== "aprovado") throw new Error("Aprove a proposta antes de enviar ao Comercial.");

  const content = (dv.content ?? {}) as { summary?: string; sections?: { title?: string; bullets?: string[] }[] };
  const escopo = content.sections?.find((s) => (s.title ?? "").toLowerCase().includes("incluído"))?.bullets ?? [];
  const items = [{ name: dv.title, qty: 1, note: "Oferta entregue no AI OS (produzida no Estúdio) — sem plano de plataforma.", escopo }];
  const validUntil = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const { data: org } = await sb.from("organizations").select("name").eq("id", dv.org_id).maybeSingle();
  const { data: prop, error } = await sb.from("proposals").insert({
    org_id: dv.org_id, title: dv.title, status: "rascunho", items,
    conditions_md: content.summary ?? null, client_name: org?.name ?? null, valid_until: validUntil,
  }).select("id").single();
  if (error) throw new Error(`Falha ao criar proposta no Comercial: ${error.message}`);

  await sb.from("studio_deliverables").update({ comm_eligible: true, comm_channel: "comercial" }).eq("id", id);
  await auditService("studio.to_commercial", "studio_deliverables", id, { proposal_id: prop.id }, dv.org_id);
  redirect(`/admin/propostas/${prop.id}`);
}

// ── R3.5 · Formação: emitir certificado + gerar slides (reuso R3.4) ──

/** Emite um certificado (PDF v2 + identidade + assinatura por atribuição), auditado; reemissão versiona. */
export async function emitirCertificadoAction(deliverableId: string, formData: FormData) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("id, org_id, title, line, brand, project_id, content, status").eq("id", deliverableId).single();
  if (!dv) throw new Error("Formação não encontrada.");
  if (!FORMACAO_TIPOS.includes(dv.line ?? "")) throw new Error("Só formações emitem certificado.");
  if (!["aprovado", "publicado"].includes(dv.status)) throw new Error("Aprove/publique a formação antes de emitir certificados.");
  const participante = String(formData.get("participante") ?? "").trim();
  if (!participante) throw new Error("Informe o nome do participante.");
  const notaRaw = String(formData.get("nota") ?? "").trim();
  const nota = notaRaw ? Math.round(Number(notaRaw)) : null;

  const payload = (dv.content as DeliverableContent)?.formacao;
  const carga = payload?.carga_horaria ?? null;
  const attribution = (dv.brand === "andre_kachan" ? "andre_kachan" : "salestrack") as "salestrack" | "andre_kachan";
  const idn = await programIdentity(dv.project_id);

  const html = buildCertificateHtml({
    participante, formacao: dv.title, cargaHoraria: carga, data: new Date().toLocaleDateString("pt-BR"),
    attribution, accent: idn.accent, logo: idn.logo, programName: idn.programName,
  });
  const pdf = await htmlToPdf(html);
  const buffer = pdf ?? Buffer.from(html, "utf-8");
  const ext = pdf ? "pdf" : "html";

  // versão = nº de certificados já emitidos p/ esse participante nesta formação + 1 (reemissão)
  const { count } = await sb.from("formacao_certificados").select("id", { count: "exact", head: true }).eq("deliverable_id", deliverableId).eq("participante_nome", participante);
  const version = (count ?? 0) + 1;
  const path = `${dv.org_id}/certificados/${deliverableId}/${participante.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v${version}.${ext}`;
  const up = await sb.storage.from("entregaveis").upload(path, buffer, { contentType: pdf ? "application/pdf" : "text/html; charset=utf-8", upsert: true });
  if (up.error) throw new Error(`Falha ao gravar certificado: ${up.error.message}`);

  await sb.from("formacao_certificados").insert({
    org_id: dv.org_id, deliverable_id: deliverableId, participante_nome: participante,
    participante_email: String(formData.get("email") ?? "").trim() || null,
    formacao_titulo: dv.title, carga_horaria: carga, brand_attribution: attribution, nota, version, rendered_url: path, emitido_por: m.userId,
  });
  await auditService("formacao.certificado_emitido", "formacao_certificados", deliverableId, { participante, version, degraded: !pdf }, dv.org_id);
  const url = await signedArtifactUrl(path, true);
  if (url) redirect(url);
  revalidatePath(`/admin/entregaveis/${deliverableId}`);
}

/** Gera os SLIDES da formação como um novo entregável (apresentacao), reusando composeDeck (R3.4). */
export async function gerarSlidesDaFormacaoAction(deliverableId: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, title, line, brand, project_id, phase_index, content").eq("id", deliverableId).single();
  if (!dv) throw new Error("Formação não encontrada.");
  if (!FORMACAO_TIPOS.includes(dv.line ?? "")) throw new Error("Só formações geram slides.");
  const payload = (dv.content as DeliverableContent)?.formacao;
  if (!payload?.modulos?.length) throw new Error("Sem módulos para compor os slides.");
  const { data: org } = await sb.from("organizations").select("name").eq("id", dv.org_id).maybeSingle();
  const deck = composeFormacaoDeck(payload, org?.name ?? undefined);
  const id = await createDeliverable({
    orgId: dv.org_id, kind: "apresentacao", title: `Slides · ${dv.title}`,
    content: { cover: { eyebrow: "Apresentação", title: `Slides · ${dv.title}`, subtitle: org?.name ?? undefined }, deck },
    format: "pptx", line: "apresentacao", brand: dv.brand, projectId: dv.project_id, phaseIndex: dv.phase_index,
    status: "em_revisao", actorId: m.userId,
  });
  await auditService("formacao.slides_gerados", "studio_deliverables", id, { from: deliverableId }, dv.org_id);
  redirect(`/admin/entregaveis/${id}`);
}

// ── R3.7 · Arte: gerar arte de um post + baixar PNG ──

/** Gera a ARTE de um post (R3.6) a partir da sugestão visual — par copy+arte para o R4. */
export async function gerarArteDoPostAction(postId: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, title, line, brand, project_id, phase_index, content").eq("id", postId).single();
  if (!dv) throw new Error("Post não encontrado.");
  if (dv.line !== "post") throw new Error("Só posts geram arte pareada.");
  const msg = (dv.content as DeliverableContent)?.message;
  const sugestao = msg?.sugestao_visual || msg?.texto?.slice(0, 120) || "Arte do post";
  const { data: org } = await sb.from("organizations").select("name").eq("id", dv.org_id).maybeSingle();
  const content = creativeFromPost(sugestao, "1:1", postId, { orgId: dv.org_id, orgName: org?.name ?? "Cliente", rag: "" });
  const id = await createDeliverable({
    orgId: dv.org_id, kind: "one_pager", title: `Arte · ${dv.title}`, content,
    format: "html", line: "arte", brand: dv.brand, projectId: dv.project_id, phaseIndex: dv.phase_index,
    sourceType: "manual", sourceId: postId, status: "em_revisao", actorId: m.userId,
  });
  await auditService("arte.do_post", "studio_deliverables", id, { from: postId }, dv.org_id);
  redirect(`/admin/entregaveis/${id}`);
}

/** Renderiza o criativo em PNG (todos os slides) e devolve o link do primeiro. */
export async function baixarPngAction(deliverableId: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, project_id, brand, content").eq("id", deliverableId).single();
  if (!dv) throw new Error("Entregável não encontrado.");
  const creative = (dv.content as DeliverableContent)?.creative;
  if (!creative) throw new Error("Este entregável não é um criativo.");
  const idn = await programIdentity(dv.project_id);
  const attribution = dv.brand === "andre_kachan" ? "André Kachan" : "Salestrack AI";
  const { pngs } = await renderCreativePngs(creative, { accent: idn.accent, logo: idn.logo, programName: idn.programName ?? attribution });
  let firstPath: string | null = null;
  for (let i = 0; i < pngs.length; i++) {
    const png = pngs[i]; if (!png) continue;
    const path = `${dv.org_id}/criativos/${deliverableId}/slide-${i + 1}.png`;
    const up = await sb.storage.from("entregaveis").upload(path, png, { contentType: "image/png", upsert: true });
    if (!up.error && !firstPath) firstPath = path;
  }
  await auditService("arte.png_gerado", "studio_deliverables", deliverableId, { slides: pngs.filter(Boolean).length }, dv.org_id);
  if (!firstPath) throw new Error("Não foi possível gerar o PNG (Chromium indisponível). Use o preview.");
  const url = await signedArtifactUrl(firstPath, true);
  if (url) redirect(url);
  revalidatePath(`/admin/entregaveis/${deliverableId}`);
}

// ── R3.8 · Vídeo: disparar render nas ferramentas da Salestrack (graceful) ──
export async function dispararRenderVideoAction(deliverableId: string) {
  const m = await requireAdmin();
  const sb = createServiceClient();
  const { data: dv } = await sb.from("studio_deliverables").select("org_id, line, status, content").eq("id", deliverableId).single();
  if (!dv) throw new Error("Vídeo não encontrado.");
  if (dv.line !== "video_roteiro") throw new Error("Só vídeos têm render.");
  if (!["aprovado", "publicado"].includes(dv.status)) throw new Error("Aprove o storyboard antes de renderizar.");
  const video = (dv.content as DeliverableContent)?.video;
  if (!video) throw new Error("Sem storyboard para renderizar.");
  const res = await triggerVideoRender({ tipo: video.tipo, roteiro: video.roteiro, storyboard: video.storyboard, voiceover: video.voiceover });
  await sb.from("studio_deliverables").update({ render_status: res.status, render_tool: res.tool, video_ref: res.video_ref }).eq("id", deliverableId);
  await auditService("video.render", "studio_deliverables", deliverableId, { status: res.status, tool: res.tool }, dv.org_id);
  revalidatePath(`/admin/entregaveis/${deliverableId}`);
}

// ── R4.2 · Envio unitário de teste (permissionado, só admin) ──
export async function enviarTesteAction(deliverableId: string, formData: FormData) {
  await requireAdmin();
  const canal = String(formData.get("canal") ?? "email") as "whatsapp" | "email";
  await sendOne({
    deliverableId, canal, test: true, optIn: formData.get("opt_in") === "on",
    recipient: {
      nome: String(formData.get("nome") ?? "").trim() || undefined,
      empresa: String(formData.get("empresa") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
    },
  });
  revalidatePath(`/admin/entregaveis/${deliverableId}`);
}

/** Devolve a URL assinada do artefato para baixar/visualizar. */
export async function downloadAction(id: string): Promise<string> {
  await requireAdmin();
  const sb = createServiceClient();
  const { data } = await sb.from("studio_deliverables").select("rendered_url").eq("id", id).single();
  if (!data?.rendered_url) throw new Error("Ainda não renderizado.");
  const url = await signedArtifactUrl(data.rendered_url, true);
  if (!url) throw new Error("Falha ao gerar link.");
  return url;
}
