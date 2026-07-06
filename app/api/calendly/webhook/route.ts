import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { calendlyConfigured, resolveOrgByEmail } from "@/lib/live-sessions";
import { notifyAdmin } from "@/lib/whatsapp";

/**
 * Webhook Calendly (modo degradado quando CALENDLY_WEBHOOK_TOKEN não está definido).
 * Configurar no Calendly apontando para /api/calendly/webhook, com ?token=CALENDLY_WEBHOOK_TOKEN.
 * Evento tratado: invitee.created → cria uma sessão "agendada" para a org do participante.
 * Sem token configurado: não processa (retorna ok:false, degraded), evitando erro de webhook mal configurado.
 */
export async function POST(req: NextRequest) {
  if (!calendlyConfigured()) return NextResponse.json({ ok: false, degraded: true, reason: "calendly_not_configured" });
  const token = new URL(req.url).searchParams.get("token");
  if (token !== process.env.CALENDLY_WEBHOOK_TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const event = String(body?.event ?? "");
  const payload = body?.payload ?? {};
  if (event !== "invitee.created") return NextResponse.json({ ok: true, ignored: event });

  const email = String(payload?.email ?? payload?.invitee?.email ?? "");
  const eventName = String(payload?.scheduled_event?.name ?? payload?.event_type?.name ?? "Sessão");
  const startTime = payload?.scheduled_event?.start_time ?? payload?.start_time ?? null;
  const meet = payload?.scheduled_event?.location?.join_url ?? payload?.location?.join_url ?? null;
  const calendlyRef = String(payload?.uri ?? payload?.event ?? "") || null;

  const orgId = email ? await resolveOrgByEmail(email) : null;
  const sb = createServiceClient();
  if (!orgId) {
    await auditService("session.calendly_unmatched", "sessions", undefined, { email, eventName }, undefined);
    return NextResponse.json({ ok: true, matched: false });
  }
  // tipo padrão: sessao_estrategica (admin pode reclassificar no programa)
  await sb.from("sessions").insert({
    org_id: orgId, type: "sessao_estrategica", title: eventName, status: "agendada",
    scheduled_at: startTime ? new Date(startTime).toISOString() : null, meet_link: meet, calendly_ref: calendlyRef,
  });
  await auditService("session.calendly_created", "sessions", undefined, { email, eventName }, orgId);
  await notifyAdmin(`📅 Nova sessão agendada via Calendly: ${eventName}`);
  return NextResponse.json({ ok: true, matched: true });
}
