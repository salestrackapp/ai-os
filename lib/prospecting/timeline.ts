import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { googleConfigured, listGmail, listCalendar } from "@/lib/google";

/** Insere um evento de timeline evitando duplicar por external_ref no mesmo subject. */
async function addEvent(sb: ReturnType<typeof createServiceClient>, ev: { subject_type: string; subject_id: string; source: string; kind: string; summary: string; occurred_at: string | null; external_ref: string | null }): Promise<boolean> {
  if (ev.external_ref) {
    const { data: dup } = await sb.from("timeline_events").select("id").eq("subject_id", ev.subject_id).eq("external_ref", ev.external_ref).limit(1).maybeSingle();
    if (dup) return false;
  }
  await sb.from("timeline_events").insert({ ...ev, occurred_at: ev.occurred_at ?? new Date().toISOString() });
  return true;
}

/**
 * Ingestão da timeline de um prospect a partir das contas SALESTRACK (Gmail + Calendar).
 * Cada fonte é independente e degrada sem env — a timeline nunca quebra.
 * Fronteira: só lê a caixa/agenda da Salestrack; nada do ambiente do cliente.
 */
export async function ingestProspectTimeline(prospectId: string): Promise<{ gmail: number; calendar: number; degraded: boolean }> {
  const sb = createServiceClient();
  const { data: p } = await sb.from("prospects").select("email, name, account_id").eq("id", prospectId).single();
  if (!p?.email) return { gmail: 0, calendar: 0, degraded: !(await googleConfigured()) };
  if (!(await googleConfigured())) return { gmail: 0, calendar: 0, degraded: true };

  let gmail = 0, calendar = 0;
  for (const m of await listGmail(`from:${p.email} OR to:${p.email}`, 10)) {
    if (await addEvent(sb, { subject_type: "prospect", subject_id: prospectId, source: "gmail", kind: "email", summary: m.summary, occurred_at: m.when, external_ref: m.ref })) gmail++;
  }
  for (const e of await listCalendar(p.email, 10)) {
    if (await addEvent(sb, { subject_type: "prospect", subject_id: prospectId, source: "calendar", kind: "reuniao", summary: e.summary, occurred_at: e.when, external_ref: e.ref })) calendar++;
  }
  await auditService("timeline.ingest", "timeline_events", prospectId, { gmail, calendar }, undefined);
  return { gmail, calendar, degraded: false };
}

/** Lê a timeline de um subject (prospect|deal|org) para exibição. */
export async function readTimeline(subjectType: string, subjectId: string) {
  const sb = createServiceClient();
  const { data } = await sb.from("timeline_events").select("*").eq("subject_type", subjectType).eq("subject_id", subjectId).order("occurred_at", { ascending: false }).limit(50);
  return data ?? [];
}
