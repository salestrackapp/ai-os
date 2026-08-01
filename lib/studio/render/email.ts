import { isAccentPermitido } from "@/lib/deliverables/types";
import { EMAIL_ENCARREGADO, urlDireitos } from "@/lib/lgpd/contato";

export type EmailInput = {
  assunto: string;
  preheader?: string;
  corpo: string[];              // parágrafos/blocos
  cta?: { label: string; url?: string };
  logo?: string | null;
  programName?: string | null;
  attribution?: "salestrack" | "andre_kachan";
  accent?: string | null;
  /**
   * Link real de descadastro. Quando ausente, o rodapé mostra o e-mail de privacidade em vez de
   * um link — um "Descadastrar" que não descadastra é pior do que não oferecer o link.
   */
  unsubscribeUrl?: string | null;
  companyAddress?: string | null;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * E-mail HTML MailerLite-ready (R3.6): CSS INLINE, largura segura 600px, cabeçalho ink v2 + acento,
 * corpo claro legível, CTA no acento da marca, rodapé com via REAL de descadastro (link quando há
 * token, endereço de privacidade quando não há). Web font degrada p/ Arial.
 */
export function buildEmailHtml(input: EmailInput): string {
  const accent = isAccentPermitido(input.accent) ? input.accent! : "#007A94";
  const assinatura = input.attribution === "andre_kachan" ? "André Kachan" : "Salestrack AI";
  const font = "font-family:'Montserrat',Arial,Helvetica,sans-serif;";
  // Descadastrar para de receber; a página de direitos decide o que fica guardado. Coisas
  // diferentes, e a segunda não pode depender de a pessoa adivinhar que a primeira não apaga nada.
  const saida = (input.unsubscribeUrl
    ? `Não quer mais receber? <a href="${esc(input.unsubscribeUrl)}" style="color:${accent};text-decoration:underline;">Descadastrar</a>.`
    : `Para não receber mais, escreva para <a href="mailto:${EMAIL_ENCARREGADO}" style="color:${accent};text-decoration:underline;">${EMAIL_ENCARREGADO}</a>.`)
    + ` <a href="${urlDireitos()}" style="color:${accent};text-decoration:underline;">Ver, corrigir ou apagar meus dados</a>.`;
  const body = input.corpo.map((p) => `<p style="margin:0 0 16px;${font}font-size:16px;line-height:1.6;color:#26303A;">${esc(p)}</p>`).join("");
  const cta = input.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:${accent};">
    <a href="${esc(input.cta.url ?? "{{cta_url}}")}" style="display:inline-block;padding:13px 26px;${font}font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(input.cta.label)}</a></td></tr></table>` : "";
  const logo = input.logo ? `<img src="${esc(input.logo)}" alt="" height="34" style="height:34px;display:block;margin-bottom:12px;">` : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.assunto)}</title></head>
<body style="margin:0;padding:0;background:#EEF1F5;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader ?? "")}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(11,11,22,.08);">
        <tr><td style="background:#1A1A2E;padding:24px 32px;border-bottom:3px solid ${accent};">
          ${logo}<span style="${font}font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${accent};">${esc(input.programName ?? assinatura)}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 18px;${font}font-size:24px;font-weight:800;color:#1A1A2E;line-height:1.2;">${esc(input.assunto)}</h1>
          ${body}
          ${cta}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#1A1A2E;">
          <p style="margin:0 0 6px;${font}font-size:11px;color:#6B7A8D;">Enviado por ${esc(assinatura)}${input.programName ? ` · ${esc(input.programName)}` : ""}.</p>
          <p style="margin:0;${font}font-size:11px;color:#6B7A8D;">${saida}${input.companyAddress ? ` ${esc(input.companyAddress)}` : ""}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
