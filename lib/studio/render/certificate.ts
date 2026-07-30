import { isAccentPermitido } from "@/lib/deliverables/types";

export type CertificateInput = {
  participante: string;
  formacao: string;
  cargaHoraria?: string | null;
  data: string;                 // já formatada (ex.: "05/07/2026")
  attribution?: "salestrack" | "andre_kachan";
  accent?: string | null;       // paleta v2
  logo?: string | null;
  programName?: string | null;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Certificado A4 paisagem no design Salestrack AI v2. Assinatura conforme atribuição de marca. */
export function buildCertificateHtml(input: CertificateInput): string {
  const accent = isAccentPermitido(input.accent) ? input.accent! : "#00B4D8";
  const assinatura = input.attribution === "andre_kachan" ? "André Kachan" : "Salestrack AI";
  const emissor = input.attribution === "andre_kachan" ? "André Kachan · Método" : "Salestrack AI · Formação";
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#1A1A2E;color:#F7F8FA;font-family:'Montserrat',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cert{width:1123px;height:794px;margin:0 auto;padding:64px 80px;position:relative;background:radial-gradient(1200px 500px at 80% -10%, rgba(139,92,255,.16), transparent),#1A1A2E;display:flex;flex-direction:column}
  .frame{position:absolute;inset:28px;border:1px solid rgba(255,255,255,.10);border-radius:18px;pointer-events:none}
  .frame::before{content:'';position:absolute;left:-1px;top:-1px;width:120px;height:6px;background:${accent};border-radius:6px}
  .eyebrow{font-size:13px;letter-spacing:.34em;text-transform:uppercase;color:${accent};margin-bottom:8px}
  .logo{height:40px;margin-bottom:24px}
  h1{font-size:26px;font-weight:800;letter-spacing:-.02em}
  .to{font-size:15px;color:#93A1B3;margin-top:44px}
  .name{font-size:56px;font-weight:800;letter-spacing:-.03em;margin-top:8px;line-height:1.05}
  .name::after{content:'';display:block;width:220px;height:3px;background:${accent};margin-top:14px;border-radius:2px}
  .body{font-size:17px;color:#93A1B3;margin-top:26px;max-width:80%;line-height:1.6}
  .body b{color:#F7F8FA}
  .foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end}
  .sign{border-top:1px solid rgba(255,255,255,.2);padding-top:8px;min-width:280px}
  .sign .n{font-family:'JetBrains Mono',monospace;font-size:13px;color:#F7F8FA}
  .sign .r{font-size:11px;color:#6B7A8D;letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
  .seal{width:96px;height:96px;border-radius:50%;border:2px solid ${accent};display:flex;align-items:center;justify-content:center;color:#00E5FF;font-size:34px}
  .meta{font-family:'JetBrains Mono',monospace;font-size:12px;color:#6B7A8D;margin-top:6px}
  @page{size:A4 landscape;margin:0}
  `;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Certificado — ${esc(input.participante)}</title><style>${css}</style></head>
  <body><div class="cert"><div class="frame"></div>
    ${input.logo ? `<img class="logo" src="${esc(input.logo)}" alt="">` : ""}
    <p class="eyebrow">Certificado de conclusão</p>
    <h1>${esc(input.programName ?? emissor)}</h1>
    <p class="to">Certificamos que</p>
    <p class="name">${esc(input.participante)}</p>
    <p class="body">concluiu com aproveitamento a formação <b>${esc(input.formacao)}</b>${input.cargaHoraria ? `, com carga horária de <b>${esc(input.cargaHoraria)}</b>` : ""}.</p>
    <div class="foot">
      <div>
        <div class="sign"><p class="n">${esc(assinatura)}</p><p class="r">${esc(emissor)}</p></div>
        <p class="meta">Emitido em ${esc(input.data)}</p>
      </div>
      <div class="seal">✳</div>
    </div>
  </div></body></html>`;
}
