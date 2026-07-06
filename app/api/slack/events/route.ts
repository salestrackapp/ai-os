import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { slackConfigured, verifySlackSignature, postSlackMessage } from "@/lib/slack";
import { runConsultorTurn } from "@/lib/agents/channel";

/**
 * Slack Events API — Consultor do Programa via Slack (canal por cliente enterprise).
 * Sem SLACK_BOT_TOKEN/SLACK_SIGNING_SECRET → canal inativo (não quebra).
 * Mapeamento canal→org fica em app_settings key='slack_channels' (jsonb { channel_id: org_id }),
 * configurável pelo admin. Menção/DM ao bot → runConsultorTurn(canal slack) → resposta no thread.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const payload = (() => { try { return JSON.parse(raw); } catch { return {}; } })();

  // Handshake de verificação da URL (Slack)
  if (payload?.type === "url_verification") return NextResponse.json({ challenge: payload.challenge });

  if (!slackConfigured()) return NextResponse.json({ ok: false, degraded: true, reason: "slack_not_configured" });
  if (!verifySlackSignature(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Ignora retries do Slack (evita processar/duplicar em timeout)
  if (req.headers.get("x-slack-retry-num")) return NextResponse.json({ ok: true, retry_ignored: true });

  const ev = payload?.event ?? {};
  const isUserMsg = (ev.type === "app_mention" || ev.type === "message") && !ev.bot_id && !ev.subtype && ev.user;
  const rawText = String(ev.text ?? "").replace(/<@[^>]+>/g, "").trim(); // remove a menção ao bot
  const channel = String(ev.channel ?? "");
  if (!isUserMsg || !rawText || !channel) return NextResponse.json({ ok: true });

  const sb = createServiceClient();
  const { data: map } = await sb.from("app_settings").select("value").eq("key", "slack_channels").maybeSingle();
  const orgId = (map?.value as Record<string, string> | null)?.[channel] ?? null;
  if (!orgId) {
    await postSlackMessage(channel, "Este canal ainda não está vinculado a um programa. Fale com a equipe Salestrack.", ev.thread_ts ?? ev.ts);
    return NextResponse.json({ ok: true, matched: false });
  }

  try {
    const turn = await runConsultorTurn({ orgId, canal: "slack", text: rawText });
    await postSlackMessage(channel, turn.text, ev.thread_ts ?? ev.ts);
  } catch { /* nunca quebra o webhook */ }
  return NextResponse.json({ ok: true });
}
