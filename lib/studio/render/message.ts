import { isAccentPermitido } from "@/lib/deliverables/types";
import type { ChannelKey } from "../copy/channel";

export type MessageInput = {
  canal: ChannelKey;
  plataforma?: string | null;   // post: LinkedIn/Instagram
  texto: string;
  variaveis?: string[];
  hashtags?: string[];
  sugestao_visual?: string | null;  // post → gancho p/ Arte (R3.7)
  cta?: string | null;
  variantes?: string[];         // variações A/B
  accent?: string | null;
  footer?: string;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
/** Destaca {{variaveis}} no texto (violeta). */
function hi(text: string, accent: string): string {
  return esc(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, `<span style="color:${accent};font-weight:600;">{{$1}}</span>`).replace(/\n/g, "<br>");
}

/** Preview v2 (ink/Montserrat) de mensagem de canal, com variáveis visíveis e gancho visual (post). */
export function buildMessageHtml(input: MessageInput): string {
  const accent = isAccentPermitido(input.accent) ? input.accent! : "#00B4D8";
  const label = { post: `Post${input.plataforma ? ` · ${input.plataforma}` : ""}`, mensagem: "Mensagem", whatsapp: "WhatsApp", email: "E-mail" }[input.canal];
  const variantes = (input.variantes ?? []).filter(Boolean);
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#1A1A2E;color:#F7F8FA;font-family:'Montserrat',sans-serif;padding:28px}
  .wrap{max-width:640px;margin:0 auto}
  .badge{display:inline-block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${accent};border:1px solid rgba(139,92,255,.4);border-radius:999px;padding:5px 12px;margin-bottom:16px}
  .bubble{background:#141C24;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px 24px;font-size:16px;line-height:1.6;white-space:pre-wrap}
  .wa .bubble{background:#111b21;border-color:rgba(37,211,102,.18);border-radius:10px 16px 16px 16px}
  .tags{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px}
  .tag{font-size:13px;color:${accent};background:rgba(139,92,255,.1);border-radius:999px;padding:4px 10px}
  .cta{display:inline-block;margin-top:16px;background:${accent};color:#fff;font-weight:700;padding:10px 20px;border-radius:10px;font-size:14px}
  .meta{margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:13px;color:#93A1B3}
  .meta b{color:#F7F8FA}
  .var{font-family:'JetBrains Mono',monospace;color:${accent}}
  .visual{margin-top:14px;padding:14px 16px;border:1px dashed rgba(255,255,255,.14);border-radius:12px;color:#93A1B3;font-size:14px}
  .variant{margin-top:12px;background:#141C24;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 16px;font-size:14px;color:#93A1B3}
  .foot{margin-top:22px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6B7A8D;font-family:'JetBrains Mono',monospace}`;
  const tags = input.hashtags?.length ? `<div class="tags">${input.hashtags.map((h) => `<span class="tag">${esc(h.startsWith("#") ? h : "#" + h)}</span>`).join("")}</div>` : "";
  const cta = input.cta ? `<div><span class="cta">${esc(input.cta)}</span></div>` : "";
  const visual = input.canal === "post" && input.sugestao_visual ? `<div class="visual"><b>Arte sugerida (R3.7):</b> ${esc(input.sugestao_visual)}</div>` : "";
  const vars = input.variaveis?.length ? `<p style="margin-top:10px">Variáveis: ${input.variaveis.map((v) => `<span class="var">{{${esc(v.replace(/[{}]/g, ""))}}}</span>`).join(" ")} <i>(preenchidas no envio — R4)</i></p>` : "";
  const variantsHtml = variantes.length ? `<div class="meta"><b>Variantes</b>${variantes.map((v, i) => `<div class="variant"><b style="color:${accent}">${String.fromCharCode(65 + i)}.</b> ${hi(v, accent)}</div>`).join("")}</div>` : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)}</title><style>${css}</style></head>
  <body><div class="wrap ${input.canal === "whatsapp" ? "wa" : ""}">
    <span class="badge">${esc(label)}</span>
    <div class="bubble">${hi(input.texto, accent)}</div>
    ${tags}${cta}${visual}
    <div class="meta">${vars || "<i>Sem variáveis.</i>"}</div>
    ${variantsHtml}
    <p class="foot">${esc(input.footer ?? "Salestrack AI")} · pronto para a Comunicação enviar</p>
  </div></body></html>`;
}
