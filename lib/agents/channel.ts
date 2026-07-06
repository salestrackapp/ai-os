import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgent, type ChatMsg } from "@/lib/agents/runner";
import { buildClientContext, saveClientMemory } from "@/lib/agents/context";

const RATE_LIMIT = 20;      // mensagens de usuário por org
const RATE_WINDOW_S = 60;

export type TurnResult = { conversationId: string; text: string; degraded: boolean; limited?: boolean };

/**
 * Executa um turno do Consultor num canal (portal|whatsapp|slack).
 * Continuidade é POR ORG: o histórico enviado ao agente são as últimas mensagens da org
 * (qualquer canal), então o cliente pode começar no portal e continuar no WhatsApp.
 * Isolamento absoluto: todas as queries filtram por orgId; nunca traz dados de outra org.
 */
export async function runConsultorTurn(opts: {
  orgId: string; canal: "portal" | "whatsapp" | "slack"; text: string; userId?: string | null; conversationId?: string | null;
}): Promise<TurnResult> {
  const { orgId, canal, text } = opts;
  const sb = createServiceClient();

  // Rate limit por org (janela deslizante) — vale para todos os canais
  const since = new Date(Date.now() - RATE_WINDOW_S * 1000).toISOString();
  const { count } = await sb.from("messages").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return { conversationId: opts.conversationId ?? "", text: "Você enviou muitas mensagens em pouco tempo. Aguarde um instante e tente de novo.", degraded: false, limited: true };
  }

  // Conversa: valida posse; senão, retoma a thread recente do canal ou cria
  let conversationId = opts.conversationId ?? null;
  let created = false;
  if (conversationId) {
    const { data: c } = await sb.from("conversations").select("id, org_id").eq("id", conversationId).maybeSingle();
    if (!c || c.org_id !== orgId) conversationId = null;
  }
  if (!conversationId) {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: recent } = await sb.from("conversations").select("id").eq("org_id", orgId).eq("canal", canal).gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent) conversationId = recent.id;
    else {
      const { data: nc } = await sb.from("conversations").insert({ org_id: orgId, agent_key: "consultor_programa", canal, aberta_por: opts.userId ?? null }).select("id").single();
      conversationId = nc!.id; created = true;
    }
  }

  const convId: string = conversationId!;

  // Histórico POR ORG (continuidade entre canais) — as últimas mensagens da org
  const { data: hist } = await sb.from("messages").select("role, content").eq("org_id", orgId).in("role", ["user", "assistant"]).order("created_at", { ascending: false }).limit(20);
  const history: ChatMsg[] = ((hist ?? []) as { role: string; content: string }[]).reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));

  await sb.from("messages").insert({ conversation_id: convId, org_id: orgId, role: "user", content: text });

  const extraContext = await buildClientContext(orgId, text);
  const result = await runAgent({ agentKey: "consultor_programa", orgId, userMessages: [...history, { role: "user", content: text }], extraContext });

  await sb.from("messages").insert({ conversation_id: convId, org_id: orgId, role: "assistant", content: result.text, tokens: result.tokens });
  if (created && !result.degraded) await saveClientMemory(orgId, `Tópico de conversa (${canal}): ${text.slice(0, 160)}`, opts.userId ?? null);

  return { conversationId: convId, text: result.text, degraded: result.degraded };
}
