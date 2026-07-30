import "server-only";

/**
 * E-mail transacional via Resend (notificações de proposta/contrato/fatura).
 * Divisão de responsabilidade: Resend = transacional 1:1 disparado por evento;
 * MailerLite = audiência/campanhas de marketing (lib/mailerlite.ts).
 * Modo degradado: sem RESEND_API_KEY, loga e segue (nunca quebra o fluxo).
 */
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "AI OS · Salestrack <aios@salestrack.com.br>";

export function emailConfigured() { return !!KEY; }

/**
 * Identidade v6 (navy/ciano da Academy). Antes eram GOLD #C89B3C + NAVY #0F1A24 — o dourado
 * da identidade ANTIGA, que os testes do Estúdio proíbem explicitamente nos entregáveis
 * (`not.toContain("#C89B3C")`). O e-mail transacional escapou daquela varredura e continuou
 * saindo em dourado depois do redesign inteiro.
 */
const CIANO = "#007A94", NAVY = "#1A1A2E", CIANO_CLARO = "#00B4D8";

/** Wrapper visual da marca para os e-mails transacionais. */
function wrap(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:Arial,Helvetica,sans-serif;padding:24px 12px">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E8EF;border-radius:12px;overflow:hidden">
    <div style="background:${NAVY};padding:20px 28px">
      <p style="margin:0;letter-spacing:.28em;text-transform:uppercase;color:${CIANO_CLARO};font-size:10px">AI Operation System</p>
    </div>
    <div style="padding:28px">
      <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:${NAVY};margin:0 0 12px">${title}</h1>
      <div style="color:#333;font-size:14px;line-height:1.6">${bodyHtml}</div>
      ${cta ? `<p style="margin:24px 0 4px"><a href="${cta.url}" style="background:${CIANO};color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block">${cta.label}</a></p>` : ""}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #E3E8EF">
      <p style="margin:0;letter-spacing:.24em;text-transform:uppercase;color:#6B7A8D;font-size:9px;text-align:center">André Kachan · Salestrack AI</p>
    </div>
  </div></body></html>`;
}

export async function sendEmail(opts: { to: string | string[]; subject: string; title: string; bodyHtml: string; cta?: { label: string; url: string } }): Promise<{ ok: boolean; degraded?: boolean }> {
  if (!KEY) { console.warn(`[email] Resend não configurado — "${opts.subject}" não enviado (degradado).`); return { ok: false, degraded: true }; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: Array.isArray(opts.to) ? opts.to : [opts.to], subject: opts.subject, html: wrap(opts.title, opts.bodyHtml, opts.cta) }),
    });
    if (!res.ok) { console.warn("[email] Resend falhou:", res.status, await res.text().catch(() => "")); return { ok: false }; }
    return { ok: true };
  } catch (e) { console.warn("[email] erro:", (e as Error).message); return { ok: false }; }
}

/** E-mail para os admins (env ADMIN_EMAILS, separado por vírgula). Nunca quebra o fluxo. */
export async function emailAdmin(subject: string, title: string, bodyHtml: string): Promise<void> {
  const tos = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!tos.length) { console.warn("[email] ADMIN_EMAILS não configurado."); return; }
  try { await sendEmail({ to: tos, subject, title, bodyHtml }); } catch { /* nunca quebra */ }
}
