import { isAccentPermitido, type CreativePayload, type CreativeSize, type CreativeTemplate, type CreativeSlide } from "@/lib/deliverables/types";

/** Presets de tamanho (px) para redes sociais (R3.7). */
export const CREATIVE_SIZES: Record<CreativeSize, { w: number; h: number; label: string }> = {
  "1:1": { w: 1080, h: 1080, label: "Feed 1:1" },
  "4:5": { w: 1080, h: 1350, label: "Feed 4:5" },
  "9:16": { w: 1080, h: 1920, label: "Stories 9:16" },
  "16:9": { w: 1200, h: 675, label: "Wide 16:9" },
};

/** Biblioteca de templates (áreas declaradas). Todos no design v2. */
export const CREATIVE_TEMPLATES: Record<CreativeTemplate, { label: string; areas: string[] }> = {
  citacao: { label: "Card de citação", areas: ["headline", "autor", "logo"] },
  numero: { label: "Card de número", areas: ["dado", "headline", "logo"] },
  anuncio: { label: "Anúncio", areas: ["headline", "copy", "cta", "logo"] },
  carrossel: { label: "Slide de carrossel", areas: ["headline", "copy", "dado", "index"] },
  capa: { label: "Capa/banner", areas: ["headline", "copy", "logo"] },
  thumbnail: { label: "Thumbnail", areas: ["headline", "logo"] },
};

export type CreativeRenderOpts = { accent?: string | null; logo?: string | null; programName?: string | null; footer?: string };

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Conteúdo interno de um slide conforme o template (sem o canvas). */
function slideInner(template: CreativeTemplate, c: CreativeSlide, accent: string, idx?: { i: number; n: number }): string {
  const head = c.headline ? `<h1 class="hl">${esc(c.headline)}</h1>` : "";
  const copy = c.copy ? `<p class="cp">${esc(c.copy)}</p>` : "";
  switch (template) {
    case "citacao":
      return `<blockquote class="q">“${esc(c.headline ?? c.copy)}”</blockquote>${c.autor ? `<p class="au">— ${esc(c.autor)}</p>` : ""}`;
    case "numero":
      return `${c.dado ? `<p class="big">${esc(c.dado.value)}</p><p class="bl">${esc(c.dado.label)}</p>${c.dado.caption ? `<p class="bc">${esc(c.dado.caption)}</p>` : ""}` : head}`;
    case "anuncio":
      return `${head}${copy}${c.cta ? `<span class="cta">${esc(c.cta)}</span>` : ""}`;
    case "carrossel":
      return `${idx ? `<span class="idx">${idx.i + 1}/${idx.n}</span>` : ""}${head}${copy}${c.dado ? `<p class="big2">${esc(c.dado.value)} <span class="bl2">${esc(c.dado.label)}</span></p>` : ""}`;
    case "capa":
      return `${head}${copy}`;
    default: // thumbnail
      return head;
  }
}

/** CSS do canvas v2 (bloom/gradiente) — fundo por IA (imagem_fundo) entra como camada sob o overlay. */
function canvasCss(size: CreativeSize, accent: string, bg?: string): string {
  const { w, h } = CREATIVE_SIZES[size];
  const isTall = h > w;
  return `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{margin:0;padding:0;background:#1A1A2E}
  .canvas{position:relative;width:${w}px;height:${h}px;overflow:hidden;color:#F7F8FA;font-family:'Montserrat',sans-serif;
    ${bg ? `background:#1A1A2E;` : `background:radial-gradient(900px 600px at 78% -8%, ${accent}33, transparent), radial-gradient(700px 500px at -10% 108%, #00E5FF14, transparent), #1A1A2E;`}
    display:flex;flex-direction:column;justify-content:center;padding:${isTall ? "110px 90px" : "80px 90px"}}
  .bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42}
  .overlay{position:absolute;inset:0;background:linear-gradient(180deg, rgba(11,11,22,.35), rgba(11,11,22,.82))}
  .content{position:relative;z-index:2}
  .eyebrow{font-size:${isTall ? 30 : 26}px;letter-spacing:.24em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:28px}
  .hl{font-size:${isTall ? 88 : 72}px;font-weight:900;letter-spacing:-.03em;line-height:1.02}
  .cp{font-size:${isTall ? 40 : 34}px;color:#93A1B3;margin-top:28px;line-height:1.4;max-width:${isTall ? "100%" : "78%"}}
  .q{font-size:${isTall ? 72 : 60}px;font-weight:800;font-style:italic;line-height:1.15;border-left:8px solid #00E5FF;padding-left:36px}
  .au{font-size:30px;color:#93A1B3;margin-top:32px;padding-left:44px}
  .big{font-size:${isTall ? 300 : 240}px;font-weight:900;line-height:.9;color:#00E5FF;letter-spacing:-.05em}
  .bl{font-size:${isTall ? 46 : 40}px;color:#F7F8FA;margin-top:24px;font-weight:700}
  .bc{font-size:26px;color:#6B7A8D;margin-top:14px}
  .big2{font-size:${isTall ? 96 : 80}px;font-weight:900;color:#00E5FF;margin-top:28px}
  .bl2{font-size:32px;color:#93A1B3;font-weight:600;letter-spacing:0}
  .cta{display:inline-block;margin-top:40px;background:${accent};color:#fff;font-weight:800;font-size:34px;padding:20px 44px;border-radius:16px}
  .idx{position:absolute;top:-40px;right:0;font-family:'JetBrains Mono',monospace;font-size:28px;color:${accent}}
  .brand{position:absolute;left:90px;bottom:66px;z-index:2;display:flex;align-items:center;gap:16px}
  .brand img{height:52px}
  .brand span{font-size:26px;letter-spacing:.2em;text-transform:uppercase;color:${accent};font-weight:700}
  .spark{position:absolute;right:80px;top:76px;font-size:56px;color:#00E5FF;z-index:2}`;
}

/** HTML de UM slide/criativo, no tamanho exato do preset → screenshot vira PNG. */
export function buildCreativeSlideHtml(template: CreativeTemplate, c: CreativeSlide, size: CreativeSize, opts: CreativeRenderOpts = {}, idx?: { i: number; n: number }): string {
  const accent = isAccentPermitido(opts.accent) ? opts.accent! : "#00B4D8";
  const bg = (c as CreativePayload).imagem_fundo ?? (opts as { imagem_fundo?: string }).imagem_fundo;
  const brand = `<div class="brand">${opts.logo ? `<img src="${esc(opts.logo)}" alt="">` : ""}<span>${esc(opts.programName ?? opts.footer ?? "Salestrack AI")}</span></div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${canvasCss(size, accent, bg)}</style></head>
  <body><div class="canvas">${bg ? `<img class="bgimg" src="${esc(bg)}" alt=""><div class="overlay"></div>` : ""}
    <span class="spark" aria-hidden>✳</span>
    <div class="content"><p class="eyebrow">${esc(CREATIVE_TEMPLATES[template].label)}</p>${slideInner(template, c, accent, idx)}</div>
    ${brand}
  </div></body></html>`;
}

/** Slides de um criativo (carrossel → N; senão 1). */
export function creativeSlides(cr: CreativePayload): CreativeSlide[] {
  if (cr.template === "carrossel" && cr.slides?.length) return cr.slides;
  return [{ headline: cr.headline, copy: cr.copy, dado: cr.dado, autor: cr.autor, cta: cr.cta }];
}

/** Preview no admin: empilha os slides (miniaturas) do criativo, no design v2. */
export function buildCreativeHtml(cr: CreativePayload, opts: CreativeRenderOpts = {}): string {
  const slides = creativeSlides(cr);
  const { w, h } = CREATIVE_SIZES[cr.tamanho];
  const scale = 520 / w;
  const items = slides.map((s, i) => {
    const inner = buildCreativeSlideHtml(cr.template, s, cr.tamanho, opts, slides.length > 1 ? { i, n: slides.length } : undefined);
    const src = `data:text/html;charset=utf-8,${encodeURIComponent(inner)}`;
    return `<div class="thumb"><iframe src="${src}" width="${w}" height="${h}" style="transform:scale(${scale});transform-origin:top left;border:0" scrolling="no"></iframe></div>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=JetBrains+Mono:wght@500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#1A1A2E;color:#F7F8FA;font-family:'Montserrat',sans-serif;padding:28px}
    .meta{font-family:'JetBrains Mono',monospace;font-size:12px;color:#6B7A8D;letter-spacing:.16em;text-transform:uppercase;margin-bottom:18px}
    .grid{display:flex;flex-wrap:wrap;gap:22px}
    .thumb{width:${Math.round(w * scale)}px;height:${Math.round(h * scale)}px;overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:14px}
  </style></head><body>
    <p class="meta">${esc(CREATIVE_TEMPLATES[cr.template].label)} · ${esc(cr.tamanho)} (${w}×${h}) · ${slides.length > 1 ? `carrossel ${slides.length} slides` : "1 peça"}</p>
    <div class="grid">${items}</div>
  </body></html>`;
}
