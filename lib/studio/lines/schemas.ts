import { z } from "zod";
import type { DeliverableContent } from "@/lib/deliverables/types";
import type { LineContext } from "../define-line";

/** Prompt padrão do Estúdio: papel + objetivo da linha + formato JSON + RAG interno. */
export function studioPrompt(goal: string, jsonShape: string, ctx: LineContext): string {
  return [
    "Você é o Estúdio de Conteúdo da Salestrack. Produza o ativo abaixo usando SOMENTE o contexto interno do programa.",
    goal,
    ctx.brief ? `Foco pedido pelo consultor: ${ctx.brief}` : "",
    "",
    "Responda ESTRITAMENTE em JSON válido (sem markdown, sem cercas de código):",
    jsonShape,
    "Regras: português brasileiro, tom de copiloto (próximo e prático); nunca invente números, datas, nomes ou entregas fora do contexto.",
    "",
    "=== CONTEXTO INTERNO DO PROGRAMA (apenas deste cliente) ===",
    ctx.rag,
  ].filter(Boolean).join("\n");
}

// ── Documento genérico (relatórios, ebooks, playbooks, propostas, apresentações, formação) ──
export const docSchema = z.object({
  titulo: z.string().min(3).max(240),
  sumario: z.string().min(10).max(6000),
  secoes: z.array(z.object({
    titulo: z.string().min(2).max(240),
    corpo: z.string().max(8000).optional().catch(undefined),
    bullets: z.array(z.string().min(1).max(600)).max(24).optional().catch(undefined),
  })).min(1).max(24),
});
export type DocContent = z.infer<typeof docSchema>;
export const docJson = '{ "titulo": string, "sumario": string, "secoes": [{ "titulo": string, "corpo"?: string, "bullets"?: string[] }] }';
export function docToContent(eyebrow: string, meta: string[]) {
  return (d: DocContent, ctx: LineContext): DeliverableContent => ({
    cover: { eyebrow, title: d.titulo, subtitle: ctx.orgName, meta },
    summary: d.sumario,
    sections: d.secoes.map((s, i) => ({ id: `s${i}`, title: s.titulo, body: s.corpo, bullets: s.bullets })),

  });
}

// ── Copy / mensagens (posts, mensagens, WhatsApp, e-mail marketing) ──
export const copySchema = z.object({
  titulo: z.string().min(3).max(240),
  corpo: z.string().min(10).max(8000),
  cta: z.string().max(400).optional().catch(undefined),
  assunto: z.string().max(300).optional().catch(undefined), // e-mail
});
export type CopyContent = z.infer<typeof copySchema>;
export const copyJson = '{ "titulo": string, "corpo": string, "cta"?: string, "assunto"?: string (e-mail) }';
export function copyToContent(eyebrow: string) {
  return (d: CopyContent, ctx: LineContext): DeliverableContent => ({
    cover: { eyebrow, title: d.titulo, subtitle: ctx.orgName, meta: d.assunto ? [`Assunto: ${d.assunto}`] : undefined },
    sections: [
      { id: "copy", eyebrow: "Texto", title: "Mensagem", body: d.corpo },
      ...(d.cta ? [{ id: "cta", title: "Chamada para ação", bullets: [d.cta] }] : []),
    ],

  });
}

// ── Arte / criativos (briefing + specs; imagem final em R3.7) ──
export const artSchema = z.object({
  titulo: z.string().min(3).max(240),
  conceito: z.string().min(10).max(4000),
  especificacoes: z.array(z.string().min(1).max(500)).min(1).max(24),
  formato: z.string().min(1).max(120),
  legenda: z.string().max(2000).optional().catch(undefined),
});
export type ArtContent = z.infer<typeof artSchema>;
export const artJson = '{ "titulo": string, "conceito": string, "especificacoes": string[], "formato": string (ex.: 1080x1080), "legenda"?: string }';
export function artToContent(eyebrow: string) {
  return (d: ArtContent, ctx: LineContext): DeliverableContent => ({
    cover: { eyebrow, title: d.titulo, subtitle: ctx.orgName, meta: [`Formato ${d.formato}`] },
    summary: d.conceito,
    sections: [
      { id: "spec", eyebrow: "Especificações", title: "Direção de arte", bullets: d.especificacoes },
      ...(d.legenda ? [{ id: "leg", title: "Legenda sugerida", body: d.legenda }] : []),
    ],

  });
}

// ── Vídeo (roteiro + storyboard; render pelas ferramentas de vídeo em R3.8) ──
export const videoSchema = z.object({
  titulo: z.string().min(3).max(240),
  logline: z.string().min(10).max(2000),
  cenas: z.array(z.object({ titulo: z.string().min(2).max(240), descricao: z.string().min(3).max(2000) })).min(1).max(30),
});
export type VideoContent = z.infer<typeof videoSchema>;
export const videoJson = '{ "titulo": string, "logline": string, "cenas": [{ "titulo": string, "descricao": string }] }';
export function videoToContent(eyebrow: string) {
  return (d: VideoContent, ctx: LineContext): DeliverableContent => ({
    cover: { eyebrow, title: d.titulo, subtitle: ctx.orgName, meta: [`${d.cenas.length} cenas`] },
    summary: d.logline,
    sections: d.cenas.map((c, i) => ({ id: `c${i}`, eyebrow: `Cena ${i + 1}`, title: c.titulo, body: c.descricao })),

  });
}
