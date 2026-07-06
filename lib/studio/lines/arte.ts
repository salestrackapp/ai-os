import { z } from "zod";
import { defineLine, type LineContext } from "../define-line";
import { studioPrompt } from "./schemas";
import { CREATIVE_SIZES, CREATIVE_TEMPLATES } from "../render/creative";
import type { DeliverableContent, CreativeTemplate, CreativeSize } from "@/lib/deliverables/types";

/** Família E · Arte & Criativos (R3.7) — template v2 → PNG. IA propõe; humano aprova o visual. */

const TEMPLATES = Object.keys(CREATIVE_TEMPLATES) as [CreativeTemplate, ...CreativeTemplate[]];
const SIZES = Object.keys(CREATIVE_SIZES) as [CreativeSize, ...CreativeSize[]];
const dadoSchema = z.object({ value: z.string().min(1).max(40), label: z.string().min(1).max(120), caption: z.string().max(200).optional().catch(undefined) }).optional().catch(undefined);

// ── Arte: uma peça (card citação/número/anúncio/capa/thumbnail) ──
const arteSchema = z.object({
  tipo_criativo: z.enum(TEMPLATES),
  tamanho: z.enum(SIZES).default("1:1"),
  headline: z.string().max(240).optional().catch(undefined),
  copy: z.string().max(600).optional().catch(undefined),
  dado: dadoSchema,
  autor: z.string().max(120).optional().catch(undefined),
  cta: z.string().max(80).optional().catch(undefined),
  imagem_fundo: z.string().max(500).optional().catch(undefined),
});
const arte = defineLine({
  key: "arte", label: "Arte", description: "Criativo visual (card de citação/número, anúncio, capa, thumbnail) → PNG no v2.",
  family: "arte", brandDefault: "salestrack", kind: "one_pager", renderTarget: "html", contentSchema: arteSchema, deepenedIn: "R3.7",
  buildPrompt: (ctx) => studioPrompt(
    `Proponha UM CRIATIVO VISUAL: escolha o template (${TEMPLATES.join(", ")}) e o tamanho (${SIZES.join(", ")}), e escreva a copy. Para 'numero' use um DADO REAL do contexto (senão não use 'numero'). imagem_fundo é opcional (fica sob a marca).`,
    '{ "tipo_criativo": "citacao|numero|anuncio|capa|thumbnail", "tamanho": "1:1|4:5|9:16|16:9", "headline"?: string, "copy"?: string, "dado"?: {"value":string,"label":string,"caption"?:string}, "autor"?: string, "cta"?: string, "imagem_fundo"?: string }',
    ctx),
  toContent: (d, ctx): DeliverableContent => ({
    cover: { eyebrow: "Arte", title: d.headline ?? d.dado?.value ?? `Criativo · ${ctx.orgName}`, subtitle: ctx.orgName, meta: ["Salestrack AI", CREATIVE_TEMPLATES[d.tipo_criativo].label, d.tamanho] },
    creative: { template: d.tipo_criativo, tamanho: d.tamanho, headline: d.headline, copy: d.copy, dado: d.dado, autor: d.autor, cta: d.cta, imagem_fundo: d.imagem_fundo },
  }),
});

// ── Criativo de post: carrossel (par com o Post do R3.6) ──
const criativoPostSchema = z.object({
  tamanho: z.enum(SIZES).default("1:1"),
  slides: z.array(z.object({
    headline: z.string().max(240).optional().catch(undefined),
    copy: z.string().max(600).optional().catch(undefined),
    dado: dadoSchema,
  })).min(1).max(10),
});
const criativoPost = defineLine({
  key: "criativo_post", label: "Criativo de post (carrossel)", description: "Sequência de slides coerentes para post/carrossel → PNGs no v2.",
  family: "arte", brandDefault: "salestrack", kind: "one_pager", renderTarget: "html", contentSchema: criativoPostSchema, deepenedIn: "R3.7",
  buildPrompt: (ctx) => studioPrompt(
    `Proponha um CARROSSEL de post: 3–6 slides coerentes (gancho → desenvolvimento → CTA). Tamanho ${SIZES.join("/")} (default 1:1). Use dado real em algum slide se houver.`,
    '{ "tamanho": "1:1|4:5|9:16|16:9", "slides": [{ "headline"?: string, "copy"?: string, "dado"?: {"value":string,"label":string,"caption"?:string} }] }',
    ctx),
  toContent: (d, ctx): DeliverableContent => ({
    cover: { eyebrow: "Criativo de post", title: `Carrossel · ${ctx.orgName}`, subtitle: ctx.orgName, meta: ["Salestrack AI", "Carrossel", `${d.slides.length} slides`, d.tamanho] },
    creative: { template: "carrossel", tamanho: d.tamanho, slides: d.slides },
  }),
});

export const arteLines = [arte, criativoPost];

/** Constrói um criativo a partir da `sugestao_visual` de um post (R3.6) — par copy+arte para o R4. */
export function creativeFromPost(sugestao: string, tamanho: CreativeSize, postRef?: string, ctx?: LineContext): DeliverableContent {
  return {
    cover: { eyebrow: "Arte do post", title: (sugestao || "Arte do post").slice(0, 80), subtitle: ctx?.orgName, meta: ["Salestrack AI", "Arte do post", tamanho] },
    creative: { template: "anuncio", tamanho, headline: sugestao.slice(0, 120), copy: sugestao.length > 120 ? sugestao : undefined, postRef },
  };
}
