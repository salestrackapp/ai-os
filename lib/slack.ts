import "server-only";
import crypto from "node:crypto";

/** Slack ativo? (token do bot + signing secret). Sem envs → canal inativo, sem quebrar. */
export function slackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_SIGNING_SECRET;
}

/** Valida a assinatura do Slack (v0 HMAC-SHA256), com janela anti-replay de 5 min. */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac("sha256", secret).update(base).digest("hex")}`;
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Posta uma mensagem no Slack (opcionalmente em thread). Degrada silenciosamente sem token. */
export async function postSlackMessage(channel: string, text: string, threadTs?: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, text, thread_ts: threadTs }),
    });
  } catch { /* nunca quebra o fluxo */ }
}
