import type { DeliverableContent, DeliverableSection, DataFigure, Quote, Chart } from "@/lib/deliverables/types";

/**
 * Document renderer compartilhado (R3.3) — builders para montar documentos ricos
 * (capa/sumário/seções/bloco de dado/citação/gráfico) que saem no design v2 + identidade
 * do programa via buildDeliverableHtml (PDF/HTML). Um renderer, vários tipos (Família A).
 */

export type DocSection = {
  id?: string; eyebrow?: string; title: string; body?: string; bullets?: string[];
  figure?: DataFigure; quote?: Quote; chart?: Chart;
};

export function figure(value: string, label: string, caption?: string): DataFigure {
  return { value, label, caption };
}
export function quote(text: string, author?: string): Quote {
  return { text, author };
}
export function barChart(bars: { label: string; value: number }[], caption?: string): Chart {
  return { type: "bar", bars, caption };
}

/** Monta um DeliverableContent de documento (com sumário navegável quando houver ≥3 seções). */
export function buildDocument(opts: {
  eyebrow?: string; title: string; subtitle?: string; meta?: string[];
  summary?: string; sections: DocSection[]; toc?: boolean;
}): DeliverableContent {
  const sections: DeliverableSection[] = opts.sections.map((s, i) => ({
    id: s.id ?? `s${i}`, eyebrow: s.eyebrow, title: s.title, body: s.body, bullets: s.bullets,
    figure: s.figure, quote: s.quote, chart: s.chart,
  }));
  return {
    cover: { eyebrow: opts.eyebrow, title: opts.title, subtitle: opts.subtitle, meta: opts.meta },
    summary: opts.summary,
    toc: opts.toc ?? sections.length >= 3,
    sections,
  };
}
