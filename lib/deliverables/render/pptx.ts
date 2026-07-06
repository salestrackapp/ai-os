import "server-only";
import type { RenderInput, KPI } from "../types";
import { brandSignature, isV2Accent } from "../types";
import { deckToPptx } from "@/lib/studio/render/slides/render";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** DESIGN ÚNICO v2 (R3.2) — todo slide sai em ink/violeta/sans. A marca é só atribuição (assinatura). */
function pptxTheme(input: RenderInput) {
  const acc = isV2Accent(input.accent) ? input.accent!.replace("#", "") : "8B5CFF";
  return { primary: "0B0B16", accent: acc, kpi: "EBF212", cream: "F4F4FA", muted: "AFAFC6", surface: "1C1C2B", head: "Arial" };
}

/** DeliverableContent → PPTX 16:9 executivo (pptxgenjs). Retorna Buffer .pptx. */
export async function htmlToPptx(input: RenderInput): Promise<Buffer> {
  // R3.4 · deck de slides → motor de apresentações (layouts v2 + notas do apresentador).
  if (input.content?.deck) {
    const sig = brandSignature(input.brand_scope, input.branding);
    return deckToPptx(input.content.deck, { accent: input.accent, logo: input.logo, programName: input.programName, footer: sig.footer });
  }
  const mod: any = await import("pptxgenjs");
  const PptxGen: any = mod.default ?? mod;
  const pres: any = new PptxGen();
  // 16:9: definir AMBOS defineLayout e pres.layout (senão quebra).
  pres.defineLayout({ name: "AIOS16x9", width: 13.333, height: 7.5 });
  pres.layout = "AIOS16x9";

  const th = pptxTheme(input);
  const { primary, accent, cream, muted, surface, head } = th;
  const sig = brandSignature(input.brand_scope, input.branding);
  const c = input.content;
  const cover = c.cover ?? { title: input.title };
  const foot = (slide: any) => slide.addText(sig.footer, { x: 0.6, y: 7.0, w: 12.1, h: 0.3, fontSize: 8, color: accent, charSpacing: 2 });

  // Capa
  const s1: any = pres.addSlide(); s1.background = { color: primary };
  s1.addText((cover.eyebrow ?? sig.eyebrow).toUpperCase(), { x: 0.7, y: 1.6, w: 12, h: 0.4, fontSize: 12, color: accent, charSpacing: 3 });
  s1.addText(cover.title ?? input.title, { x: 0.7, y: 2.1, w: 12, h: 2.2, fontSize: 40, color: cream, fontFace: head, bold: true, valign: "top" });
  if (cover.subtitle) s1.addText(cover.subtitle, { x: 0.7, y: 4.4, w: 12, h: 0.6, fontSize: 16, color: muted });
  if (cover.meta?.length) s1.addText(cover.meta.join("   ·   "), { x: 0.7, y: 5.1, w: 12, h: 0.4, fontSize: 11, color: muted });
  foot(s1);

  // Sumário executivo (+ KPIs)
  if (c.summary || c.kpis?.length) {
    const s: any = pres.addSlide(); s.background = { color: primary };
    s.addText("SUMÁRIO EXECUTIVO", { x: 0.7, y: 0.6, w: 12, h: 0.4, fontSize: 12, color: accent, charSpacing: 3 });
    if (c.summary) s.addText(c.summary.slice(0, 900), { x: 0.7, y: 1.2, w: 12, h: c.kpis?.length ? 3.4 : 5.4, fontSize: 15, color: cream, valign: "top" });
    if (c.kpis?.length) kpiStrip(s, c.kpis, th);
    foot(s);
  }

  // Seções
  for (const sec of c.sections ?? []) {
    const s: any = pres.addSlide(); s.background = { color: primary };
    if (sec.eyebrow) s.addText(sec.eyebrow.toUpperCase(), { x: 0.7, y: 0.55, w: 12, h: 0.35, fontSize: 11, color: accent, charSpacing: 3 });
    s.addText(sec.title, { x: 0.7, y: 0.95, w: 12, h: 0.8, fontSize: 26, color: cream, fontFace: head, bold: true });
    let y = 1.95;
    if (sec.body) { s.addText(sec.body.slice(0, 700), { x: 0.7, y, w: 12, h: 1.8, fontSize: 13, color: muted, valign: "top" }); y += 1.9; }
    if (sec.kpis?.length) { kpiStrip(s, sec.kpis, th, y); y += 1.6; }
    if (sec.bullets?.length) s.addText(sec.bullets.map((b) => ({ text: b, options: { bullet: { code: "2713" }, color: cream, fontSize: 13, paraSpaceAfter: 6 } })), { x: 0.7, y, w: 12, h: 3.4, valign: "top" });
    if (sec.table) {
      const rows = [sec.table.head.map((h) => ({ text: h, options: { color: accent, bold: true, fontSize: 10 } })), ...sec.table.rows.map((r) => r.map((cell) => ({ text: cell, options: { color: cream, fontSize: 10 } })))];
      s.addTable(rows, { x: 0.7, y, w: 12, border: { type: "solid", color: surface, pt: 1 }, fill: { color: primary } });
    }
    foot(s);
  }

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}

function kpiStrip(slide: any, kpis: KPI[], th: { kpi: string; muted: string; head: string }, y = 4.9) {
  const n = Math.min(kpis.length, 4);
  const w = 12 / n;
  kpis.slice(0, n).forEach((k, i) => {
    const x = 0.7 + i * w;
    slide.addText(k.label.toUpperCase(), { x, y, w: w - 0.2, h: 0.35, fontSize: 9, color: th.muted, charSpacing: 1 });
    slide.addText(k.value, { x, y: y + 0.35, w: w - 0.2, h: 0.7, fontSize: 26, color: th.kpi, fontFace: th.head, bold: true });
    if (k.hint) slide.addText(k.hint, { x, y: y + 1.05, w: w - 0.2, h: 0.3, fontSize: 8, color: th.muted });
  });
}
