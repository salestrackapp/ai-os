import "server-only";
import { canalWhatsApp } from "@/lib/whatsapp";
import { googleConfigured, sendGmail } from "@/lib/google";

/** Resultado de um despacho de canal. 'manual' = sem credencial (conteúdo pronto para copiar). */
export type DispatchResult = { status: "enviado" | "falhou" | "manual"; providerRef?: string | null; erro?: string; content?: string };
export type DispatchInput = {
  orgId?: string | null; recipient: { email?: string; phone?: string };
  subject?: string; html?: string; text?: string; ref?: { table?: string; id?: string };
};

export type Channel = { key: "whatsapp" | "email"; label: string; configured(): boolean; dispatch(input: DispatchInput): Promise<DispatchResult> };

/** Abstração declarativa de canal (segredos server-only; graceful sem credencial). */
export function defineChannel(ch: Channel): Channel { return ch; }

// ── WhatsApp (Z-API, ferramenta da Salestrack) ──
export const whatsappChannel = defineChannel({
  key: "whatsapp", label: "WhatsApp (Z-API)",
  configured: () => !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN && process.env.ZAPI_CLIENT_TOKEN),
  async dispatch(input) {
    const text = input.text ?? "";
    if (!input.recipient.phone) return { status: "falhou", erro: "Sem telefone do destinatário." };
    const canal = canalWhatsApp();
    const r = await canal.enviar(input.recipient.phone, text, { org_id: input.orgId ?? null, ref_table: input.ref?.table, ref_id: input.ref?.id });
    if (r.degraded) return { status: "manual", content: text };
    return r.ok ? { status: "enviado", providerRef: r.providerRef ?? null } : { status: "falhou", erro: r.error };
  },
});

// ── E-mail (Gmail-first: caixa da Salestrack; fallback Resend; graceful manual) ──
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Salestrack AI <no-reply@salestrack.com.br>";
export const emailChannel = defineChannel({
  key: "email", label: "E-mail (Gmail / Resend)",
  configured: () => !!(RESEND_KEY || process.env.GOOGLE_OAUTH_REFRESH_TOKEN), // best-effort (Console resolvido no dispatch)
  async dispatch(input) {
    const html = input.html ?? "";
    if (!input.recipient.email) return { status: "falhou", erro: "Sem e-mail do destinatário." };
    // 1) Preferência: enviar pela caixa do Gmail (Console → env)
    if (await googleConfigured()) {
      const r = await sendGmail(input.recipient.email, input.subject ?? "(sem assunto)", html, { html: true });
      if (r.sent) return { status: "enviado", providerRef: r.id ?? null };
      // se o Gmail falhar mas houver Resend, tenta o fallback abaixo
      if (!RESEND_KEY) return { status: "falhou", erro: "Gmail não enviou (verifique credenciais no Console)." };
    }
    // 2) Fallback: Resend
    if (!RESEND_KEY) return { status: "manual", content: html }; // graceful: conteúdo pronto para envio manual
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: EMAIL_FROM, to: [input.recipient.email], subject: input.subject ?? "(sem assunto)", html }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { status: "falhou", erro: json?.message ?? `HTTP ${res.status}` };
      return { status: "enviado", providerRef: json?.id ?? null };
    } catch (e) { return { status: "falhou", erro: (e as Error).message }; }
  },
});

const CHANNELS: Record<string, Channel> = { whatsapp: whatsappChannel, email: emailChannel };
export function getChannel(key: string): Channel | undefined { return CHANNELS[key]; }
