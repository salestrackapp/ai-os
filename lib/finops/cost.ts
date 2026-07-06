import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getSetting } from "@/lib/settings/resolve";

/** Modelo ativo dos agentes (Fase 5) — usado na atribuição de custo (telemetria não guarda model por msg). */
export function activeModel(): string { return process.env.ANTHROPIC_MODEL || "claude-sonnet-5"; }
/** Modelo ativo via store (app → env → default). */
export async function activeModelLive(): Promise<string> {
  try { return (await getSetting<string>("anthropic_model_chat")) || activeModel(); } catch { return activeModel(); }
}
/** Câmbio USD→BRL do env (fallback síncrono). */
export function usdBrl(): number | null { const v = Number(process.env.USD_BRL); return Number.isFinite(v) && v > 0 ? v : null; }
/** Câmbio USD→BRL via store (app → env → default). */
export async function usdBrlLive(): Promise<number | null> {
  try { const v = Number(await getSetting("usd_brl")); return Number.isFinite(v) && v > 0 ? v : usdBrl(); } catch { return usdBrl(); }
}

// A telemetria guarda tokens TOTAIS por mensagem (sem split in/out). Assumimos 70% entrada / 30% saída
// (agentes têm muito contexto e resposta curta). Documentado; ajuste com dados reais quando houver split.
const IN_RATIO = 0.7, OUT_RATIO = 0.3;

type PriceMap = Record<string, { in: number; out: number }>;
async function priceMap(): Promise<PriceMap> {
  const sb = createServiceClient();
  const { data } = await sb.from("model_prices").select("model, price_in_per_mtok, price_out_per_mtok").eq("is_active", true);
  return Object.fromEntries((data ?? []).map((p) => [p.model, { in: Number(p.price_in_per_mtok), out: Number(p.price_out_per_mtok) }]));
}
export async function hasModelPrice(model: string): Promise<boolean> { return !!(await priceMap())[model]; }

/** Rollup idempotente do custo de IA de um dia → ai_cost_daily (por org + agent_key + model). */
export async function rollupAiCost(dayISO: string): Promise<{ orgs: number; cost_usd: number; unpriced: boolean }> {
  const sb = createServiceClient();
  const start = new Date(`${dayISO}T00:00:00Z`).toISOString();
  const end = new Date(new Date(start).getTime() + 86400000).toISOString();
  const model = activeModel();
  const prices = await priceMap();
  const price = prices[model];

  // agent_key vem da conversa; tokens das mensagens do assistente
  const { data: convs } = await sb.from("conversations").select("id, org_id, agent_key");
  const convMap: Record<string, { org_id: string; agent_key: string }> = Object.fromEntries((convs ?? []).map((c) => [c.id, { org_id: c.org_id, agent_key: c.agent_key }]));
  const { data: msgs } = await sb.from("messages").select("conversation_id, org_id, tokens, role").gte("created_at", start).lt("created_at", end).eq("role", "assistant");

  const agg: Record<string, { org_id: string; agent_key: string; tokens: number }> = {};
  for (const m of msgs ?? []) {
    const meta = convMap[m.conversation_id as string];
    const org_id = (meta?.org_id ?? m.org_id) as string;
    const agent_key = meta?.agent_key ?? "consultor_programa";
    const key = `${org_id}|${agent_key}`;
    (agg[key] ??= { org_id, agent_key, tokens: 0 }).tokens += Number(m.tokens ?? 0);
  }

  let total = 0, orgs = new Set<string>();
  for (const a of Object.values(agg)) {
    const tin = Math.round(a.tokens * IN_RATIO), tout = Math.round(a.tokens * OUT_RATIO);
    const cost = price ? (tin * price.in + tout * price.out) / 1_000_000 : 0;
    total += cost; orgs.add(a.org_id);
    await sb.from("ai_cost_daily").upsert(
      { org_id: a.org_id, date: dayISO, agent_key: a.agent_key, model, tokens_in: tin, tokens_out: tout, cost_usd: cost, computed_at: new Date().toISOString() },
      { onConflict: "org_id,date,agent_key,model" },
    );
  }
  return { orgs: orgs.size, cost_usd: total, unpriced: !price };
}

/** Custo agregado por org num intervalo (para as telas). */
export async function costByOrg(fromISO: string, toISO: string): Promise<Record<string, number>> {
  const sb = createServiceClient();
  const { data } = await sb.from("ai_cost_daily").select("org_id, cost_usd").gte("date", fromISO).lte("date", toISO);
  const out: Record<string, number> = {};
  for (const r of data ?? []) if (r.org_id) out[r.org_id] = (out[r.org_id] ?? 0) + Number(r.cost_usd ?? 0);
  return out;
}
