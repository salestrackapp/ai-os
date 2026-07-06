import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { readaiConfigured, resolveOrgByEmail } from "@/lib/live-sessions";

/**
 * Webhook Read AI (modo degradado quando READAI_WEBHOOK_TOKEN não está definido).
 * Configurar no Read AI (Integrations → Webhooks) apontando para /api/readai/webhook?token=READAI_WEBHOOK_TOKEN.
 * Recebe o relatório pós-reunião e fecha a sessão: status=realizada, grava resumo/gravação/action items,
 * debita 1 crédito. Casamento da sessão, em ordem: meet_link → readai_ref → e-mail de participante → org.
 * Se nada casar, apenas registra em auditoria (não falha).
 */
function str(v: unknown): string | null { const s = typeof v === "string" ? v.trim() : ""; return s || null; }

/** Normaliza action_items que podem vir como string[] ou {text}[] ou {action_item}[]. */
function normItems(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.map((it) => typeof it === "string" ? it : (it?.text ?? it?.action_item ?? it?.title ?? "")).map((s) => String(s).trim()).filter(Boolean);
  return out.length ? out : null;
}

export async function POST(req: NextRequest) {
  if (!readaiConfigured()) return NextResponse.json({ ok: false, degraded: true, reason: "readai_not_configured" });
  const token = new URL(req.url).searchParams.get("token");
  if (token !== process.env.READAI_WEBHOOK_TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const sess = (body?.session ?? body) as Record<string, unknown>;
  const meetUrl = str(sess?.meeting_url) ?? str(sess?.join_url) ?? str(body?.meeting_url);
  const readaiRef = str(sess?.session_id) ?? str(sess?.id) ?? str(body?.session_id) ?? str(body?.id);
  const reportUrl = str(sess?.report_url) ?? str(body?.report_url);
  // summary pode ser string ou objeto { text }
  const summaryRaw = sess?.summary ?? body?.summary;
  const summary = typeof summaryRaw === "string" ? summaryRaw.trim() || null : str((summaryRaw as Record<string, unknown>)?.text);
  const recording = str(sess?.recording_url) ?? str(body?.recording_url) ?? reportUrl;
  const actionItems = normItems(body?.action_items ?? sess?.action_items);
  const participants = (Array.isArray(sess?.participants) ? sess.participants : Array.isArray(body?.participants) ? body.participants : []) as { email?: string }[];

  const sb = createServiceClient();
  type Sref = { id: string; org_id: string; type: string; status: string };
  let session: Sref | null = null;
  const pick = async (q: PromiseLike<{ data: Sref | null }>) => { const { data } = await q; return data ?? null; };

  if (meetUrl) session = await pick(sb.from("sessions").select("id, org_id, type, status").eq("meet_link", meetUrl).order("scheduled_at", { ascending: false }).limit(1).maybeSingle());
  if (!session && readaiRef) session = await pick(sb.from("sessions").select("id, org_id, type, status").eq("readai_ref", readaiRef).limit(1).maybeSingle());
  // fallback: casa pela org de um participante (e-mail) → sessão agendada mais recente dessa org
  if (!session) {
    for (const p of participants) {
      const orgId = p?.email ? await resolveOrgByEmail(p.email) : null;
      if (orgId) { session = await pick(sb.from("sessions").select("id, org_id, type, status").eq("org_id", orgId).eq("status", "agendada").order("scheduled_at", { ascending: false }).limit(1).maybeSingle()); if (session) break; }
    }
  }
  if (!session) {
    await auditService("session.readai_unmatched", "sessions", undefined, { meetUrl, readaiRef, participants: participants.map((p) => p?.email).filter(Boolean) }, undefined);
    return NextResponse.json({ ok: true, matched: false });
  }

  await sb.from("sessions").update({
    status: "realizada", summary_md: summary, recording_url: recording, action_items: actionItems, readai_ref: readaiRef,
  }).eq("id", session.id);

  if (session.status !== "realizada") {
    const { data: cr } = await sb.from("session_credits").select("id, total, consumed").eq("org_id", session.org_id).eq("type", session.type).maybeSingle();
    if (cr && (cr.consumed ?? 0) < cr.total) await sb.from("session_credits").update({ consumed: (cr.consumed ?? 0) + 1 }).eq("id", cr.id);
  }
  await auditService("session.readai_closed", "sessions", session.id, { readaiRef }, session.org_id);
  return NextResponse.json({ ok: true, matched: true });
}
