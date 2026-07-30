import "server-only";
import type { Deck, DeckSlide } from "@/lib/deliverables/types";
import { isAccentPermitido } from "@/lib/deliverables/types";
import { normalizeDeck } from "./layouts";

export type DeckRenderOpts = { accent?: string | null; logo?: string | null; programName?: string | null; footer?: string; eyebrow?: string };

/** Tema v2 do deck (ink/Montserrat/violeta + faísca lime). Accent só da paleta v2. */
function theme(accent?: string | null) {
  const acc = isAccentPermitido(accent) ? accent! : "#00B4D8";
  return { bg: "#1A1A2E", surf: "#141C24", fg: "#F7F8FA", muted: "#93A1B3", muted2: "#6B7A8D", accent: acc, lime: "#00E5FF", line: "rgba(255,255,255,.08)" };
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ════════════════════════ HTML preview (espelha o PPTX) ════════════════════════
function slideHtml(s: DeckSlide, i: number, n: number, t: ReturnType<typeof theme>, opts: DeckRenderOpts): string {
  const eyebrow = s.eyebrow ? `<p class="s-eye">${esc(s.eyebrow)}</p>` : "";
  const foot = `<div class="s-foot"><span>${esc(opts.footer ?? "Salestrack AI")}</span><span>${i + 1}/${n}</span></div>`;
  let inner = "";
  switch (s.layout) {
    case "capa":
      inner = `${opts.logo ? `<img class="s-logo" src="${esc(opts.logo)}" alt="">` : ""}${eyebrow}<h1 class="s-title s-cap">${esc(s.title)}</h1>${s.body ? `<p class="s-sub">${esc(s.body)}</p>` : ""}`;
      break;
    case "divisor":
      inner = `<div class="s-div"><span class="s-bar"></span>${eyebrow}<h2 class="s-title">${esc(s.title)}</h2></div>`;
      break;
    case "estatistica":
      inner = `${eyebrow}<h2 class="s-h2">${esc(s.title)}</h2><p class="s-stat">${esc(s.stat?.value)}</p><p class="s-statl">${esc(s.stat?.label)}</p>${s.stat?.caption ? `<p class="s-cap-c">${esc(s.stat.caption)}</p>` : ""}`;
      break;
    case "citacao":
      inner = `<blockquote class="s-quote">“${esc(s.quote?.text)}”${s.quote?.author ? `<cite>— ${esc(s.quote.author)}</cite>` : ""}</blockquote>`;
      break;
    case "comparacao":
      inner = `${eyebrow}<h2 class="s-h2">${esc(s.title)}</h2><div class="s-cols">${(s.columns ?? []).slice(0, 3).map((c) => `<div class="s-col"><p class="s-colt">${esc(c.title)}</p>${c.body ? `<p class="s-colb">${esc(c.body)}</p>` : ""}${c.bullets?.length ? `<ul>${c.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>`;
      break;
    case "imagem":
      inner = `<h2 class="s-h2">${esc(s.title)}</h2>${s.image ? `<img class="s-img" src="${esc(s.image)}" alt="">` : `<div class="s-imgph">imagem</div>`}${s.body ? `<p class="s-body">${esc(s.body)}</p>` : ""}`;
      break;
    case "encerramento":
      inner = `${eyebrow}<h2 class="s-title">${esc(s.title)}</h2>${s.cta ? `<span class="s-cta">${esc(s.cta)}</span>` : ""}`;
      break;
    default: // conteudo
      inner = `${eyebrow}<h2 class="s-h2">${esc(s.title)}</h2>${s.body ? `<p class="s-body">${esc(s.body)}</p>` : ""}${s.bullets?.length ? `<ul class="s-ul">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}`;
  }
  const notes = s.notes ? `<p class="s-notes"><b>Notas:</b> ${esc(s.notes)}</p>` : "";
  return `<div class="slide-wrap"><div class="slide l-${s.layout}">${inner}${foot}</div>${notes}</div>`;
}

/** HTML preview do deck (v2), para revisão no admin. */
export function deckToHtml(deckIn: Deck, opts: DeckRenderOpts = {}): string {
  const deck = normalizeDeck(deckIn);
  const t = theme(opts.accent);
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:${t.bg};color:${t.fg};font-family:'Montserrat',-apple-system,Segoe UI,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .deck{max-width:1000px;margin:0 auto;padding:24px}
  .slide-wrap{margin-bottom:26px}
  .slide{position:relative;aspect-ratio:16/9;background:${t.bg};border:1px solid ${t.line};border-radius:16px;padding:56px 64px;overflow:hidden;display:flex;flex-direction:column;justify-content:center}
  .l-capa{background:linear-gradient(135deg,${t.surf},${t.bg})}
  .l-divisor,.l-encerramento{align-items:flex-start;justify-content:center}
  .s-eye{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:${t.accent};margin-bottom:14px}
  .s-title{font-size:46px;font-weight:800;letter-spacing:-.03em;line-height:1.05}
  .s-cap{font-size:54px}
  .s-sub{font-size:20px;color:${t.muted};margin-top:16px;max-width:80%}
  .s-logo{height:44px;margin-bottom:28px}
  .s-h2{font-size:34px;font-weight:800;letter-spacing:-.02em;margin-bottom:18px}
  .s-body{font-size:18px;color:${t.muted};max-width:80%;line-height:1.55}
  .s-ul{list-style:none;margin-top:12px}
  .s-ul li{position:relative;padding-left:26px;font-size:19px;color:${t.fg};margin-bottom:12px}
  .s-ul li::before{content:'▸';position:absolute;left:0;color:${t.accent}}
  .s-div .s-bar{display:block;width:64px;height:5px;background:${t.accent};border-radius:3px;margin-bottom:22px}
  .s-stat{font-size:120px;font-weight:800;line-height:1;color:${t.lime};letter-spacing:-.04em}
  .s-statl{font-size:22px;color:${t.fg};margin-top:10px}
  .s-cap-c{font-size:14px;color:${t.muted2};margin-top:8px}
  .s-quote{font-size:30px;font-style:italic;line-height:1.35;color:${t.fg};border-left:5px solid ${t.lime};padding-left:26px}
  .s-quote cite{display:block;font-size:15px;color:${t.muted2};font-style:normal;margin-top:16px;letter-spacing:.06em}
  .s-cols{display:flex;gap:28px}
  .s-col{flex:1;background:${t.surf};border:1px solid ${t.line};border-radius:14px;padding:22px}
  .s-colt{font-weight:700;font-size:18px;margin-bottom:10px;color:${t.accent}}
  .s-colb{color:${t.muted};font-size:15px}
  .s-col ul{list-style:none;margin-top:8px}
  .s-col li{padding-left:20px;position:relative;color:${t.fg};font-size:15px;margin-bottom:8px}
  .s-col li::before{content:'✓';position:absolute;left:0;color:${t.accent}}
  .s-img{max-width:100%;max-height:55%;border-radius:12px;margin-top:14px}
  .s-imgph{height:45%;border:1px dashed ${t.line};border-radius:12px;display:flex;align-items:center;justify-content:center;color:${t.muted2};margin-top:14px;text-transform:uppercase;letter-spacing:.2em;font-size:12px}
  .s-cta{display:inline-block;margin-top:22px;background:${t.accent};color:#fff;font-weight:700;padding:12px 24px;border-radius:12px;font-size:18px}
  .s-foot{position:absolute;left:64px;right:64px;bottom:26px;display:flex;justify-content:space-between;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${t.muted2};font-family:'JetBrains Mono',monospace}
  .s-notes{font-size:13px;color:${t.muted2};padding:10px 8px 0;font-family:'JetBrains Mono',monospace}
  `;
  const slides = deck.slides.map((s, i) => slideHtml(s, i, deck.slides.length, t, opts)).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(deck.title)}</title><style>${css}</style></head><body><div class="deck">${slides}</div></body></html>`;
}

// ════════════════════════ PPTX (pptxgenjs) ════════════════════════
/* eslint-disable @typescript-eslint/no-explicit-any */
function hex(c: string) { return c.replace("#", ""); }

/** Deck → PPTX 16:9 fiel ao v2 (Montserrat/violeta/lime), com notas do apresentador. */
export async function deckToPptx(deckIn: Deck, opts: DeckRenderOpts = {}): Promise<Buffer> {
  const deck = normalizeDeck(deckIn);
  const t = theme(opts.accent);
  const C = { bg: hex(t.bg), surf: hex(t.surf), fg: hex(t.fg), muted: hex(t.muted), muted2: hex(t.muted2), accent: hex(t.accent), lime: hex(t.lime) };
  const HEAD = "Montserrat";
  const foot = opts.footer ?? "Salestrack AI";

  const mod: any = await import("pptxgenjs");
  const Pptx: any = mod.default ?? mod;
  const pres: any = new Pptx();
  pres.defineLayout({ name: "AIOS169", width: 13.333, height: 7.5 });
  pres.layout = "AIOS169";

  deck.slides.forEach((s, i) => {
    const sl: any = pres.addSlide();
    sl.background = { color: s.layout === "capa" ? C.surf : C.bg };
    const eyebrow = (y: number) => s.eyebrow && sl.addText(s.eyebrow.toUpperCase(), { x: 0.7, y, w: 12, h: 0.4, fontSize: 12, color: C.accent, charSpacing: 3, fontFace: HEAD });
    if (s.layout === "capa") {
      eyebrow(1.6);
      sl.addText(s.title ?? deck.title, { x: 0.7, y: 2.1, w: 11.9, h: 2.6, fontSize: 46, bold: true, color: C.fg, fontFace: HEAD, valign: "top" });
      if (s.body) sl.addText(s.body, { x: 0.7, y: 4.7, w: 11.9, h: 0.8, fontSize: 18, color: C.muted, fontFace: HEAD });
      if (opts.programName) sl.addText(opts.programName, { x: 0.7, y: 6.6, w: 11.9, h: 0.4, fontSize: 12, color: C.muted2, fontFace: HEAD });
    } else if (s.layout === "divisor") {
      sl.addShape(pres.ShapeType.rect, { x: 0.7, y: 2.9, w: 1.1, h: 0.08, fill: { color: C.accent } });
      eyebrow(3.2);
      sl.addText(s.title ?? "", { x: 0.7, y: 3.6, w: 11.9, h: 1.4, fontSize: 40, bold: true, color: C.fg, fontFace: HEAD });
    } else if (s.layout === "estatistica") {
      eyebrow(0.7);
      if (s.title) sl.addText(s.title, { x: 0.7, y: 1.1, w: 11.9, h: 0.6, fontSize: 22, color: C.fg, fontFace: HEAD, bold: true });
      sl.addText(s.stat?.value ?? "", { x: 0.7, y: 2.1, w: 11.9, h: 2.4, fontSize: 96, bold: true, color: C.lime, fontFace: HEAD });
      sl.addText(s.stat?.label ?? "", { x: 0.7, y: 4.7, w: 11.9, h: 0.6, fontSize: 22, color: C.fg, fontFace: HEAD });
      if (s.stat?.caption) sl.addText(s.stat.caption, { x: 0.7, y: 5.4, w: 11.9, h: 0.5, fontSize: 14, color: C.muted2, fontFace: HEAD });
    } else if (s.layout === "citacao") {
      sl.addText(`“${s.quote?.text ?? ""}”`, { x: 1.0, y: 2.0, w: 11.3, h: 2.8, fontSize: 30, italic: true, color: C.fg, fontFace: HEAD, valign: "top" });
      if (s.quote?.author) sl.addText(`— ${s.quote.author}`, { x: 1.0, y: 5.0, w: 11.3, h: 0.5, fontSize: 14, color: C.muted2, fontFace: HEAD });
    } else if (s.layout === "comparacao") {
      eyebrow(0.6);
      if (s.title) sl.addText(s.title, { x: 0.7, y: 1.0, w: 11.9, h: 0.8, fontSize: 30, bold: true, color: C.fg, fontFace: HEAD });
      const cols = (s.columns ?? []).slice(0, 3); const cw = 11.9 / Math.max(cols.length, 1);
      cols.forEach((c, ci) => {
        const x = 0.7 + ci * cw;
        sl.addText(c.title, { x: x + 0.1, y: 2.1, w: cw - 0.3, h: 0.5, fontSize: 16, bold: true, color: C.accent, fontFace: HEAD });
        const lines = (c.bullets ?? []).map((b) => ({ text: b, options: { bullet: { code: "2713" }, color: C.fg, fontSize: 13, fontFace: HEAD, paraSpaceAfter: 6 } }));
        if (c.body) lines.unshift({ text: c.body, options: { color: C.muted, fontSize: 13, fontFace: HEAD, paraSpaceAfter: 8 } as any });
        if (lines.length) sl.addText(lines, { x: x + 0.1, y: 2.7, w: cw - 0.3, h: 3.6, valign: "top" });
      });
    } else if (s.layout === "encerramento") {
      eyebrow(2.7);
      sl.addText(s.title ?? "", { x: 0.7, y: 3.1, w: 11.9, h: 1.2, fontSize: 40, bold: true, color: C.fg, fontFace: HEAD });
      if (s.cta) sl.addText(s.cta, { x: 0.7, y: 4.5, w: 6, h: 0.7, fontSize: 18, bold: true, color: "FFFFFF", fill: { color: C.accent }, align: "center", fontFace: HEAD });
    } else { // conteudo / imagem
      eyebrow(0.6);
      sl.addText(s.title ?? "", { x: 0.7, y: 1.0, w: 11.9, h: 0.9, fontSize: 30, bold: true, color: C.fg, fontFace: HEAD });
      let y = 2.0;
      if (s.body) { sl.addText(s.body, { x: 0.7, y, w: 11.9, h: 1.4, fontSize: 16, color: C.muted, fontFace: HEAD, valign: "top" }); y += 1.5; }
      if (s.bullets?.length) sl.addText(s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25B8" }, color: C.fg, fontSize: 16, fontFace: HEAD, paraSpaceAfter: 8 } })), { x: 0.7, y, w: 11.9, h: 4.2, valign: "top" });
    }
    // rodapé + numeração
    sl.addText(foot, { x: 0.7, y: 7.05, w: 8, h: 0.3, fontSize: 8, color: C.accent, charSpacing: 2, fontFace: HEAD });
    sl.addText(`${i + 1}/${deck.slides.length}`, { x: 11.6, y: 7.05, w: 1.0, h: 0.3, fontSize: 8, color: C.muted2, align: "right", fontFace: HEAD });
    if (s.notes) sl.addNotes(s.notes);
  });

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}
