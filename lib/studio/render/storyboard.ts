import { isAccentPermitido, type VideoPayload, type VideoScene } from "@/lib/deliverables/types";

export type StoryboardOpts = { accent?: string | null; logo?: string | null; programName?: string | null; footer?: string; tipo?: string };

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Frame 16:9 de uma cena — reusa a linguagem visual da Arte (R3.7): ink+bloom, headline, spark. */
function frame(scene: VideoScene, accent: string, i: number, n: number, opts: StoryboardOpts): string {
  const kind = i === 0 ? "Abertura (slide R3.4)" : i === n - 1 ? "Encerramento (slide R3.4)" : "Cena";
  const headline = scene.arte?.headline ?? scene.texto_tela ?? scene.visual;
  const stat = scene.arte?.dado;
  return `<div class="frame">
    <span class="fspark" aria-hidden>✳</span>
    <span class="fcena">${esc(kind)} ${i + 1}${scene.duracao ? ` · ${esc(scene.duracao)}` : ""}</span>
    ${stat ? `<p class="fbig">${esc(stat.value)}</p><p class="fbl">${esc(stat.label)}</p>` : `<p class="fhl">${esc(headline)}</p>`}
    <span class="fbrand">${esc(opts.programName ?? opts.footer ?? "Salestrack AI")}</span>
  </div>`;
}

/** Storyboard revisável (PDF/HTML v2 + identidade): roteiro + cenas com frame visual, narração e texto em tela. */
export function buildStoryboardHtml(video: VideoPayload, opts: StoryboardOpts = {}): string {
  const accent = isAccentPermitido(opts.accent) ? opts.accent! : "#00B4D8";
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#1A1A2E;color:#F7F8FA;font-family:'Montserrat',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .doc{max-width:900px;margin:0 auto}
  .cover{padding:64px 56px 36px}
  .eyebrow{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:${accent};margin-bottom:10px}
  h1{font-size:46px;font-weight:900;letter-spacing:-.03em;line-height:1.05}
  .sub{font-size:16px;color:#93A1B3;margin-top:12px}
  .roteiro{padding:28px 56px;background:#141C24;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
  .roteiro p{color:#93A1B3;margin-bottom:10px;max-width:74ch}
  .scene{padding:26px 56px;border-top:1px solid rgba(255,255,255,.08);display:grid;grid-template-columns:360px 1fr;gap:26px;align-items:start;break-inside:avoid}
  .frame{position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;padding:22px 24px;display:flex;flex-direction:column;justify-content:center;
    background:radial-gradient(400px 240px at 80% -20%, ${accent}44, transparent), radial-gradient(300px 200px at -10% 120%, #00E5FF14, transparent), #1A1A2E;border:1px solid rgba(255,255,255,.08)}
  .fspark{position:absolute;right:16px;top:14px;color:#00E5FF;font-size:22px}
  .fcena{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${accent}}
  .fhl{font-size:24px;font-weight:800;line-height:1.12;margin-top:8px}
  .fbig{font-size:64px;font-weight:900;color:#00E5FF;line-height:1;margin-top:6px}
  .fbl{font-size:14px;color:#F7F8FA;margin-top:6px}
  .fbrand{position:absolute;left:24px;bottom:16px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${accent};font-weight:700}
  .sinfo .lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6B7A8D;margin:12px 0 4px}
  .sinfo .lbl:first-child{margin-top:0}
  .sinfo .v{font-size:15px;color:#F7F8FA;line-height:1.5}
  .sinfo .vis{color:#93A1B3;font-size:14px}
  footer{padding:28px 56px;text-align:center;border-top:1px solid rgba(255,255,255,.08)}
  footer p{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:${accent}}
  @media print{ .scene,.roteiro{break-before:auto} .scene{break-inside:avoid} @page{margin:0} .cover{break-after:avoid} }`;

  const n = video.storyboard.length;
  const scenes = video.storyboard.map((s, i) => `<div class="scene">
    ${frame(s, accent, i, n, opts)}
    <div class="sinfo">
      ${s.texto_tela ? `<p class="lbl">Texto na tela</p><p class="v">${esc(s.texto_tela)}</p>` : ""}
      ${s.narracao ? `<p class="lbl">Narração</p><p class="v">${esc(s.narracao)}</p>` : ""}
      <p class="lbl">Visual</p><p class="v vis">${esc(s.visual)}</p>
    </div>
  </div>`).join("");
  const roteiro = video.roteiro?.narracao?.length ? `<section class="roteiro"><p class="eyebrow">Roteiro · narração</p>${video.roteiro.narracao.map((p) => `<p>${esc(p)}</p>`).join("")}</section>` : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storyboard</title><style>${css}</style></head>
  <body><div class="doc">
    <header class="cover"><p class="eyebrow">Vídeo · Storyboard${opts.tipo ? ` · ${esc(opts.tipo)}` : ""}</p><h1>Storyboard</h1><p class="sub">${esc(opts.programName ?? "Salestrack AI")} · ${n} cenas${video.voiceover ? ` · voz: ${esc(video.voiceover)}` : ""}</p></header>
    ${roteiro}
    ${scenes}
    <footer><p>${esc(opts.footer ?? "Salestrack AI")}</p></footer>
  </div></body></html>`;
}
