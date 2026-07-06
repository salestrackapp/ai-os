import type { Deck, DeckSlide, SlideLayout, DataFigure } from "@/lib/deliverables/types";

/**
 * Biblioteca de layouts de slide (R3.4) — todos no design Salestrack AI v2.
 * Cada layout declara suas "áreas" para o renderizador (render.ts) preencher.
 */
export const LAYOUTS: Record<SlideLayout, { label: string; areas: string[] }> = {
  capa: { label: "Capa", areas: ["eyebrow", "title", "subtitle", "logo"] },
  divisor: { label: "Divisor de seção", areas: ["eyebrow", "title"] },
  conteudo: { label: "Conteúdo", areas: ["eyebrow", "title", "body", "bullets"] },
  estatistica: { label: "Estatística", areas: ["eyebrow", "title", "stat"] },
  citacao: { label: "Citação/destaque", areas: ["quote"] },
  comparacao: { label: "Duas colunas/comparação", areas: ["eyebrow", "title", "columns"] },
  imagem: { label: "Imagem", areas: ["title", "image", "body"] },
  encerramento: { label: "Encerramento/CTA", areas: ["eyebrow", "title", "cta"] },
};

export const SLIDE_LAYOUTS = Object.keys(LAYOUTS) as SlideLayout[];

// ── Builders (usados por toContent da linha e pela Formação via composeDeck) ──
export const slideCapa = (title: string, subtitle?: string, eyebrow = "Apresentação", notes?: string): DeckSlide => ({ layout: "capa", eyebrow, title, body: subtitle, notes });
export const slideDivisor = (title: string, eyebrow?: string, notes?: string): DeckSlide => ({ layout: "divisor", eyebrow, title, notes });
export const slideConteudo = (title: string, opts: { eyebrow?: string; body?: string; bullets?: string[]; notes?: string } = {}): DeckSlide => ({ layout: "conteudo", title, ...opts });
export const slideEstatistica = (stat: DataFigure, title = "Números como prova", eyebrow = "Resultado", notes?: string): DeckSlide => ({ layout: "estatistica", eyebrow, title, stat, notes });
export const slideCitacao = (text: string, author?: string, notes?: string): DeckSlide => ({ layout: "citacao", quote: { text, author }, notes });
export const slideEncerramento = (title: string, cta?: string, notes?: string): DeckSlide => ({ layout: "encerramento", eyebrow: "Próximo passo", title, cta, notes });

/**
 * API de composição (R3.4) — junta blocos de slides (abertura + módulos + encerramento) num
 * deck coerente, garantindo UMA capa no início e numeração implícita pela ordem.
 * É o que a Formação (R3.5) chama para montar decks de aula/módulo reaproveitando os layouts.
 */
export function composeDeck(title: string, sections: DeckSlide[][]): Deck {
  const flat = sections.flat();
  const slides: DeckSlide[] = [];
  let sawCapa = false;
  for (const s of flat) {
    if (s.layout === "capa") { if (sawCapa) continue; sawCapa = true; } // só a primeira capa
    slides.push(s);
  }
  if (!sawCapa) slides.unshift(slideCapa(title));
  return { title, slides };
}

/** Garante que um deck tem capa e ao menos 1 slide (defensivo). */
export function normalizeDeck(deck: Deck): Deck {
  const slides = deck.slides?.length ? deck.slides : [slideCapa(deck.title)];
  if (!slides.some((s) => s.layout === "capa")) slides.unshift(slideCapa(deck.title));
  return { title: deck.title, slides };
}
