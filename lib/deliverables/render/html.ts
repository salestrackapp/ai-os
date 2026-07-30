import "server-only";
import type { RenderInput, DeliverableContent, DeliverableSection, KPI } from "../types";
import { brandSignature, isAccentPermitido } from "../types";
import { deckToHtml } from "@/lib/studio/render/slides/render";
import { buildEmailHtml } from "@/lib/studio/render/email";
import { buildMessageHtml } from "@/lib/studio/render/message";
import { buildCreativeHtml } from "@/lib/studio/render/creative";
import { buildStoryboardHtml } from "@/lib/studio/render/storyboard";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function paras(body?: string): string {
  if (!body) return "";
  return body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

type Theme = {
  bg: string; surf: string; surf2: string; fg: string; muted: string; muted2: string;
  accent: string; accent2: string; line: string; accentLine: string;
  fontImport: string; fontBody: string; fontHead: string; fontMono: string;
  headWeight: number; headTracking: string; headUpper: boolean;
};

/**
 * DESIGN ÚNICO Salestrack AI v2 (R3.2) — TODA entrega sai aqui: ink/Montserrat/violeta + spark lime.
 * A "marca" (salestrack × André Kachan) é só ATRIBUIÇÃO (logo/assinatura), nunca troca o design.
 * `accent` da identidade do programa só entra se pertencer à paleta v2 (senão cai no violeta padrão).
 */
function theme(accent?: string | null): Theme {
  const acc = isAccentPermitido(accent) ? accent! : "#00B4D8";
  return {
    bg: "#1A1A2E", surf: "#141C24", surf2: "#0D1F3C", fg: "#F7F8FA", muted: "#93A1B3", muted2: "#6B7A8D",
    accent: acc, accent2: "#00E5FF", line: "rgba(255,255,255,.08)", accentLine: "rgba(139,92,255,.36)",
    fontImport: "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');",
    fontBody: "'Montserrat',-apple-system,Segoe UI,Roboto,sans-serif",
    fontHead: "'Montserrat',-apple-system,Segoe UI,sans-serif",
    fontMono: "'JetBrains Mono',ui-monospace,monospace",
    headWeight: 800, headTracking: "-0.03em", headUpper: false,
  };
}

function kpiRow(kpis?: KPI[]): string {
  if (!kpis?.length) return "";
  return `<div class="kpis">${kpis.map((k) => `
    <div class="kpi"><p class="kpi-l">${esc(k.label)}</p><p class="kpi-v">${esc(k.value)}</p>${k.hint ? `<p class="kpi-h">${esc(k.hint)}</p>` : ""}</div>`).join("")}</div>`;
}

function tableHtml(t?: DeliverableSection["table"]): string {
  if (!t) return "";
  return `<div class="tw"><table>
    <thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    ${t.foot ? `<tfoot><tr>${t.foot.map((c) => `<td>${esc(c)}</td>`).join("")}</tr></tfoot>` : ""}
  </table></div>`;
}

/** Bloco de dado: número grande como prova + legenda (R3.3). */
function figureHtml(f?: DeliverableSection["figure"]): string {
  if (!f) return "";
  return `<div class="figure"><p class="fig-v">${esc(f.value)}</p><p class="fig-l">${esc(f.label)}</p>${f.caption ? `<p class="fig-c">${esc(f.caption)}</p>` : ""}</div>`;
}
function quoteHtml(q?: DeliverableSection["quote"]): string {
  if (!q) return "";
  return `<blockquote class="quote"><p>${esc(q.text)}</p>${q.author ? `<cite>— ${esc(q.author)}</cite>` : ""}</blockquote>`;
}
/** Gráfico de barras simples, SVG inline no v2 (accent). Escala 0..max. */
function chartHtml(ch?: DeliverableSection["chart"]): string {
  if (!ch?.bars?.length) return "";
  const bars = ch.bars.slice(0, 8);
  const max = Math.max(...bars.map((b) => b.value), 1);
  const W = 760, H = 200, pad = 28, bw = (W - pad * 2) / bars.length;
  const rects = bars.map((b, i) => {
    const h = Math.max(2, ((H - pad * 2) * b.value) / max);
    const x = pad + i * bw + bw * 0.15, y = H - pad - h, w = bw * 0.7;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="var(--accent)"></rect>
      <text x="${(x + w / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" fill="var(--accent2)" font-size="12" font-family="${"'JetBrains Mono',monospace"}">${esc(b.value)}</text>
      <text x="${(x + w / 2).toFixed(1)}" y="${(H - pad + 16).toFixed(1)}" text-anchor="middle" fill="var(--muted2)" font-size="11">${esc(b.label)}</text>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img"><line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--line)"/>${rects}</svg>${ch.caption ? `<p class="fig-c">${esc(ch.caption)}</p>` : ""}</div>`;
}

function sectionHtml(s: DeliverableSection): string {
  return `<section class="sec" id="sec-${esc(s.id)}">
    ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}
    <h2>${esc(s.title)}</h2>
    ${s.body ? `<div class="prose">${paras(s.body)}</div>` : ""}
    ${figureHtml(s.figure)}
    ${chartHtml(s.chart)}
    ${kpiRow(s.kpis)}
    ${s.bullets?.length ? `<ul class="bul">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
    ${quoteHtml(s.quote)}
    ${tableHtml(s.table)}
  </section>`;
}

/** Sumário navegável a partir dos títulos das seções (R3.3). */
function tocHtml(sections: DeliverableSection[]): string {
  if (!sections.length) return "";
  return `<section class="toc"><p class="eyebrow">Sumário</p><ol>${sections.map((s) => `<li><span class="toc-t">${esc(s.title)}</span></li>`).join("")}</ol></section>`;
}

/** Documento HTML executivo, standalone (CSS embutido, sem dependência do app). */
export function buildDeliverableHtml(input: RenderInput): string {
  const c: DeliverableContent = input.content ?? { cover: { title: input.title } };
  const sig = brandSignature(input.brand_scope, input.branding);
  const logoFor = input.logo ?? (input.brand_scope === "tenant" ? input.branding?.logo_url : null) ?? null;
  const attribution = input.brand_scope === "andre_kachan" ? "andre_kachan" : "salestrack";
  // R3.4 · apresentações: quando há deck, renderiza o preview de slides (mesmo v2 + identidade).
  if (c.deck) return deckToHtml(c.deck, { accent: input.accent, logo: logoFor, programName: input.programName, footer: sig.footer });
  // R3.6 · mensagens & copy: e-mail (MailerLite-ready) e mensagem/whatsapp/post (texto + variáveis).
  if (c.email) return buildEmailHtml({ ...c.email, logo: logoFor, programName: input.programName, attribution, accent: input.accent });
  if (c.message) return buildMessageHtml({ ...c.message, accent: input.accent, footer: sig.footer });
  // R3.7 · arte & criativos: preview dos slides (template v2 + identidade → PNG na produção).
  if (c.creative) return buildCreativeHtml(c.creative, { accent: input.accent, logo: logoFor, programName: input.programName, footer: sig.footer });
  // R3.8 · vídeo: storyboard revisável (v2 + identidade; frames reusam a Arte, abertura/encerramento os slides).
  if (c.video) return buildStoryboardHtml(c.video, { accent: input.accent, logo: logoFor, programName: input.programName, footer: sig.footer, tipo: c.video.tipo });
  const t = theme(input.accent);
  const logo = input.logo ?? (input.brand_scope === "tenant" ? input.branding?.logo_url : null) ?? null;
  const cover = c.cover ?? { title: input.title };
  const headCase = t.headUpper ? "text-transform:uppercase;" : "";

  const css = `
  ${t.fontImport}
  :root{ --bg:${t.bg}; --surf:${t.surf}; --surf2:${t.surf2}; --fg:${t.fg}; --accent:${t.accent}; --accent2:${t.accent2};
    --muted:${t.muted}; --muted2:${t.muted2}; --line:${t.line}; --accentline:${t.accentLine}; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  html,body{ background:var(--bg); color:var(--fg);
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ font-family:${t.fontBody}; font-size:14px; line-height:1.6; }
  .doc{ max-width:900px; margin:0 auto; }
  h1{ font-family:${t.fontHead}; font-weight:${t.headWeight}; letter-spacing:${t.headTracking}; ${headCase} font-size:52px; line-height:1.06; margin-bottom:18px; }
  h2{ font-family:${t.fontHead}; font-weight:${t.headWeight}; letter-spacing:${t.headTracking}; ${headCase} font-size:30px; margin-bottom:18px; }
  .eyebrow{ font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:var(--accent); margin-bottom:6px; }
  .cover{ padding:72px 56px 48px; }
  .cover .kicker{ font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); margin-bottom:20px; }
  .cover .sub{ font-size:17px; color:var(--muted); }
  .cover .meta{ margin-top:22px; display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:var(--muted2); }
  .logo{ height:40px; margin-bottom:26px; }
  .summary{ padding:34px 56px; background:var(--surf); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .summary .prose{ max-width:70ch; color:var(--fg); font-size:15px; }
  .sec{ padding:34px 56px; border-top:1px solid var(--line); }
  .prose p{ color:var(--muted); margin-bottom:12px; max-width:74ch; }
  .prose p:last-child{ margin-bottom:0; }
  .bul{ list-style:none; margin-top:10px; }
  .bul li{ position:relative; padding-left:22px; color:var(--muted); margin-bottom:8px; max-width:74ch; }
  .bul li::before{ content:'✓'; position:absolute; left:0; color:var(--accent); }
  .kpis{ display:flex; flex-wrap:wrap; gap:16px; margin-top:16px; }
  .kpi{ flex:1 1 150px; background:var(--surf2); border:1px solid var(--line); border-radius:14px; padding:18px; }
  .kpi-l{ font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted2); }
  .kpi-v{ font-family:${t.fontHead}; font-weight:${t.headWeight}; font-size:30px; color:var(--accent2); line-height:1.1; margin-top:4px; }
  .kpi-h{ font-size:11px; color:var(--muted2); margin-top:2px; }
  .tw{ overflow-x:auto; margin-top:16px; }
  table{ width:100%; border-collapse:collapse; }
  th{ text-align:left; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted2); padding:10px 12px; border-bottom:1px solid var(--line); }
  td{ padding:11px 12px; border-bottom:1px solid var(--line); color:var(--fg); font-size:13px; }
  tfoot td{ font-weight:700; color:var(--accent); border-top:1px solid var(--accentline); }
  .mono{ font-family:${t.fontMono}; }
  /* R3.3 · sumário navegável */
  .toc{ padding:28px 56px; border-top:1px solid var(--line); }
  .toc ol{ margin-top:12px; counter-reset:toc; list-style:none; }
  .toc li{ counter-increment:toc; display:flex; align-items:baseline; gap:12px; padding:7px 0; border-bottom:1px dashed var(--line); }
  .toc li::before{ content:counter(toc,decimal-leading-zero); font-family:${t.fontMono}; font-size:12px; color:var(--accent); }
  .toc-t{ color:var(--fg); font-size:15px; }
  /* R3.3 · bloco de dado (número como prova) */
  .figure{ margin-top:18px; padding:26px 28px; background:var(--surf); border:1px solid var(--line); border-left:3px solid var(--accent); border-radius:14px; }
  .fig-v{ font-family:${t.fontHead}; font-weight:${t.headWeight}; font-size:52px; line-height:1; color:var(--accent2); }
  .fig-l{ font-size:14px; color:var(--fg); margin-top:8px; }
  .fig-c{ font-size:12px; color:var(--muted2); margin-top:6px; max-width:70ch; }
  /* R3.3 · citação */
  .quote{ margin-top:18px; padding:18px 24px; border-left:3px solid var(--accent2); background:var(--surf); border-radius:0 12px 12px 0; }
  .quote p{ font-size:18px; color:var(--fg); font-style:italic; }
  .quote cite{ display:block; margin-top:8px; font-size:12px; color:var(--muted2); font-style:normal; letter-spacing:.06em; }
  /* R3.3 · gráfico */
  .chart{ margin-top:18px; padding:18px; background:var(--surf); border:1px solid var(--line); border-radius:14px; }
  footer{ padding:30px 56px; border-top:1px solid var(--line); text-align:center; }
  footer p{ font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); }
  /* Quebra de página: nas seções PAI (break-inside em flex é instável no Chromium). */
  @media print{
    :root{ --bg:${t.bg}; --accent:${t.accent}; --fg:${t.fg}; }
    html,body{ background:var(--bg); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .doc{ max-width:none; }
    .summary,.sec,.toc{ break-before:page; }
    .cover{ break-after:avoid; }
    .figure,.quote,.chart{ break-inside:avoid; }
    @page{ margin:0; }
  }`;

  const secList = c.sections ?? [];
  const sections = secList.map(sectionHtml).join("");
  const toc = c.toc ? tocHtml(secList) : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title)}</title><style>${css}</style></head>
<body><div class="doc">
  <header class="cover">
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ""}
    <p class="kicker">${esc(cover.eyebrow ?? sig.eyebrow)}</p>
    <h1>${esc(cover.title ?? input.title)}</h1>
    ${cover.subtitle ? `<p class="sub">${esc(cover.subtitle)}</p>` : ""}
    ${cover.meta?.length ? `<div class="meta">${cover.meta.map((m) => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
  </header>
  ${c.summary ? `<section class="summary"><p class="eyebrow">Sumário executivo</p><div class="prose">${paras(c.summary)}</div>${kpiRow(c.kpis)}</section>`
    : c.kpis?.length ? `<section class="summary">${kpiRow(c.kpis)}</section>` : ""}
  ${toc}
  ${sections}
  <footer><p>${esc(c.footer ?? sig.footer)}</p></footer>
</div></body></html>`;
}
