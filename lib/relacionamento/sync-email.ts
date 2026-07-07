import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { googleConfigured, listGmailInbox, getGmailBody, type GmailMsg } from "@/lib/google";
import { requireTeam } from "./inbox";
import { avaliarRegras } from "./responder";

/**
 * Carrega o CORPO COMPLETO dos e-mails de uma conversa ao abri-la (E1 guardava só o snippet).
 * Busca no Gmail por id (external_ref), atualiza rel_mensagens.corpo e marca media.full=true (cache). Graceful.
 */
export async function carregarCorposEmail(conversaId: string): Promise<{ carregados: number }> {
  await requireTeam();
  if (!(await googleConfigured())) return { carregados: 0 };
  const sb = createServiceClient();
  const { data: conv } = await sb.from("rel_conversas").select("channel").eq("id", conversaId).maybeSingle();
  if (conv?.channel !== "email") return { carregados: 0 };

  // mensagens recebidas/sincronizadas (têm o id do Gmail em external_ref) ainda sem corpo completo
  const { data: msgs } = await sb.from("rel_mensagens").select("id, external_ref, media").eq("conversa_id", conversaId).not("external_ref", "is", null);
  let carregados = 0;
  for (const mm of msgs ?? []) {
    const media = (mm.media as { full?: boolean; html?: string | null } | null) ?? null;
    if (media?.full) continue;                         // já em cache
    const body = await getGmailBody(String(mm.external_ref));
    if (!body || !body.text) continue;
    await sb.from("rel_mensagens").update({ corpo: body.text, media: { ...(media ?? {}), full: true, html: body.html } }).eq("id", mm.id);
    carregados++;
  }
  return { carregados };
}

/** Aplica regras (rótulo/atribuição) a uma conversa NOVA — rascunham o roteamento, nunca enviam. */
async function aplicarRegras(sb: ReturnType<typeof createServiceClient>, orgId: string, convId: string, dados: { contato_email: string | null; assunto: string | null; assigned_to: string | null }) {
  const acoes = await avaliarRegras(dados);
  if (!acoes.length) return;
  for (const a of acoes) {
    if (a.assignTo && !dados.assigned_to) {
      await sb.from("rel_conversas").update({ assigned_to: a.assignTo }).eq("id", convId);
      dados.assigned_to = a.assignTo;
    }
    if (a.rotulo) {
      let { data: rot } = await sb.from("rel_rotulos").select("id").eq("org_id", orgId).eq("nome", a.rotulo).maybeSingle();
      if (!rot) { const { data: ins } = await sb.from("rel_rotulos").insert({ org_id: orgId, nome: a.rotulo }).select("id").single(); rot = ins; }
      if (rot?.id) await sb.from("rel_conversa_rotulos").upsert({ conversa_id: convId, rotulo_id: rot.id }, { onConflict: "conversa_id,rotulo_id" });
    }
  }
}

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
/** Org da Salestrack (dona da caixa de equipe) via service — funciona sem sessão (cron/auto-sync). */
async function salestrackOrgId(sb: ReturnType<typeof createServiceClient>): Promise<string | null> {
  const { data } = await sb.from("organizations").select("id").eq("is_salestrack", true).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function syncGmailInbox(max = 40): Promise<{ synced: number; novas: number; degraded?: boolean }> {
  if (!(await googleConfigured())) return { synced: 0, novas: 0, degraded: true };
  const sbOrg = createServiceClient();
  const orgId = await salestrackOrgId(sbOrg);
  if (!orgId) return { synced: 0, novas: 0, degraded: true };

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
      convId = ins?.id; if (convId) { novas++; await aplicarRegras(sb, orgId, convId, { contato_email: email, assunto, assigned_to: null }); }
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
