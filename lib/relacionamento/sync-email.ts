import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { googleConfigured, listGmailInbox, type GmailMsg } from "@/lib/google";
import { requireTeam } from "./inbox";

/** "Nome <email>" → { nome, email }. */
function parseAddr(raw: string | null): { nome: string | null; email: string | null } {
  if (!raw) return { nome: null, email: null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { nome: (m[1] || null)?.trim() || null, email: m[2].trim().toLowerCase() };
  const e = raw.match(/[^\s<>]+@[^\s<>]+/);
  return { nome: null, email: e ? e[0].toLowerCase() : null };
}

/**
 * Sincroniza a caixa da Salestrack (Gmail) para o modelo do E0 (E1 · read-first).
 * Agrupa por thread → rel_conversas (channel=email) + rel_mensagens (in|out).
 * Idempotente (dedup por thread e por id de mensagem). Graceful: sem Google → {degraded}.
 */
export async function syncGmailInbox(max = 40): Promise<{ synced: number; novas: number; degraded?: boolean }> {
  const { orgId } = await requireTeam();
  if (!(await googleConfigured())) return { synced: 0, novas: 0, degraded: true };

  const msgs = await listGmailInbox({ max });
  const sb = createServiceClient();
  const threads = new Map<string, GmailMsg[]>();
  for (const m of msgs) { const arr = threads.get(m.threadId) ?? []; arr.push(m); threads.set(m.threadId, arr); }

  let synced = 0, novas = 0;
  for (const [threadId, tmsgs] of threads) {
    tmsgs.sort((a, b) => a.internalDate - b.internalDate);
    const last = tmsgs[tmsgs.length - 1];
    const inMsg = tmsgs.find((m) => m.direction === "in");
    const { nome, email } = parseAddr(inMsg ? inMsg.from : last.to);
    const assunto = tmsgs.find((m) => m.subject)?.subject ?? "(sem assunto)";
    const lastAt = last.date ?? new Date(last.internalDate).toISOString();

    let { data: conv } = await sb.from("rel_conversas").select("id").eq("channel", "email").eq("external_ref", threadId).is("deleted_at", null).maybeSingle();
    let convId = conv?.id as string | undefined;
    if (!convId) {
      const { data: ins } = await sb.from("rel_conversas").insert({
        org_id: orgId, channel: "email", external_ref: threadId, assunto,
        contato_nome: nome, contato_email: email, status: "aberta",
        unread: last.direction === "in", last_message_at: lastAt,
      }).select("id").single();
      convId = ins?.id; if (convId) novas++;
    } else {
      await sb.from("rel_conversas").update({ assunto, contato_nome: nome, contato_email: email, last_message_at: lastAt, updated_at: new Date().toISOString() }).eq("id", convId);
    }
    if (!convId) continue;

    let novaEntrada = false;
    for (const m of tmsgs) {
      const { data: exists } = await sb.from("rel_mensagens").select("id").eq("external_ref", m.id).maybeSingle();
      if (exists) continue;
      await sb.from("rel_mensagens").insert({
        conversa_id: convId, direction: m.direction, corpo: m.snippet, external_ref: m.id,
        status_entrega: m.direction === "in" ? "recebido" : "enviado",
        created_at: m.date ?? new Date(m.internalDate).toISOString(),
      });
      synced++;
      if (m.direction === "in") novaEntrada = true;
    }
    if (novaEntrada) await sb.from("rel_conversas").update({ unread: true }).eq("id", convId);
  }
  await auditService("rel.sync_email", "rel_conversas", undefined, { synced, novas }, orgId);
  return { synced, novas };
}
