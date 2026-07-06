import { z } from "zod";
import { defineLine } from "../define-line";
import { studioPrompt } from "./schemas";
import { SLIDE_LAYOUTS, composeDeck, slideDivisor, slideConteudo, slideEncerramento } from "../render/slides/layouts";
import type { Deck, DeckSlide } from "@/lib/deliverables/types";

/** Família B · Apresentações (R3.4) — motor de slides reutilizável (deck → PPTX + preview HTML). */

const slideSchema = z.object({
  layout: z.enum(SLIDE_LAYOUTS as [string, ...string[]]),
  eyebrow: z.string().max(120).optional().catch(undefined),
  title: z.string().max(240).optional().catch(undefined),
  body: z.string().max(2000).optional().catch(undefined),
  bullets: z.array(z.string().min(1).max(400)).max(10).optional().catch(undefined),
  stat: z.object({ value: z.string().min(1).max(60), label: z.string().min(1).max(200), caption: z.string().max(300).optional().catch(undefined) }).optional().catch(undefined),
  quote: z.object({ text: z.string().min(1).max(600), author: z.string().max(160).optional().catch(undefined) }).optional().catch(undefined),
  columns: z.array(z.object({ title: z.string().min(1).max(160), body: z.string().max(600).optional().catch(undefined), bullets: z.array(z.string().min(1).max(300)).max(8).optional().catch(undefined) })).max(3).optional().catch(undefined),
  cta: z.string().max(200).optional().catch(undefined),
  notas: z.string().max(1200).optional().catch(undefined),
});
const apresentacaoSchema = z.object({
  titulo: z.string().min(3).max(240),
  slides: z.array(slideSchema).min(3).max(30),
});

/** Converte os slides validados no modelo Deck (notas do apresentador incluídas). */
function toDeck(titulo: string, slides: z.infer<typeof slideSchema>[]): Deck {
  const mapped: DeckSlide[] = slides.map((s) => ({
    layout: s.layout as DeckSlide["layout"], eyebrow: s.eyebrow, title: s.title, body: s.body, bullets: s.bullets,
    stat: s.stat, quote: s.quote, columns: s.columns, cta: s.cta, notes: s.notas,
  }));
  return { title: titulo, slides: mapped };
}

export const apresentacaoLine = defineLine({
  key: "apresentacao", label: "Apresentação executiva", description: "Deck 16:9 com roteiro, slides e notas do apresentador — PPTX + preview.",
  family: "apresentacoes", brandDefault: "salestrack", kind: "apresentacao", renderTarget: "pptx", contentSchema: apresentacaoSchema, deepenedIn: "R3.4",
  buildPrompt: (ctx) => studioPrompt(
    `Monte uma APRESENTAÇÃO EXECUTIVA (deck 16:9) sobre o programa: roteiro de 6–12 slides, conteúdo por slide e NOTAS do apresentador em cada um. Use os layouts: ${SLIDE_LAYOUTS.join(", ")}. Comece com 'capa', use 'divisor' entre partes, 'estatistica' SOMENTE com números reais do contexto (senão não use), 'encerramento' com CTA no fim.`,
    '{ "titulo": string, "slides": [{ "layout": "capa|divisor|conteudo|estatistica|citacao|comparacao|imagem|encerramento", "eyebrow"?: string, "title"?: string, "body"?: string, "bullets"?: string[], "stat"?: {"value":string,"label":string,"caption"?:string}, "quote"?: {"text":string,"author"?:string}, "columns"?: [{"title":string,"body"?:string,"bullets"?:string[]}], "cta"?: string, "notas"?: string }] }',
    ctx),
  toContent: (d, ctx) => ({
    cover: { eyebrow: "Apresentação", title: d.titulo, subtitle: ctx.orgName, meta: ["Salestrack AI", "Deck 16:9"] },
    deck: toDeck(d.titulo, d.slides),
  }),
});

export const apresentacoesLines = [apresentacaoLine];

/**
 * Reuso pela Formação (R3.5): compõe um deck multi-parte (abertura + módulos + encerramento)
 * a partir de blocos de slides, preservando capa/identidade e numeração. Exemplo de uso:
 *   moduleDeck("Curso de IA", [ [slideDivisor("Módulo 1")], modulo1Slides, [slideDivisor("Módulo 2")], modulo2Slides ])
 */
export function moduleDeck(titulo: string, partes: DeckSlide[][]): Deck {
  return composeDeck(titulo, [
    [{ layout: "capa", eyebrow: "Formação", title: titulo }],
    ...partes,
    [slideEncerramento("Obrigado", "Vamos ao próximo passo")],
  ]);
}

// (helpers re-exportados p/ a Formação montar módulos sem reimplementar)
export { slideDivisor, slideConteudo, slideEncerramento };
