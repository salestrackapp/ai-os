import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Registro durável de execução de agente, no agent-control.
 *
 * ── O buraco que fecha ────────────────────────────────────────────────────────────────────────
 * As chamadas ao Claude no AI OS são síncronas e não deixam rastro: quando uma resposta sai
 * errada, não há como saber qual prompt a gerou, quanto custou, nem quanto demorou. O custo de IA
 * só aparece na fatura da Anthropic, num número só, sem dizer de qual cliente veio.
 *
 * ── O que este arquivo faz, e o que NÃO faz ───────────────────────────────────────────────────
 * FAZ: registra cada execução no agent-control — entrada, saída, tokens, custo, latência, erro.
 * NÃO FAZ: mover a execução para lá. O agent-control depende do Trigger.dev para processar, que
 * ainda não está configurado. Delegar agora seria mandar trabalho para quem não processa.
 *
 * A ponte fica pronta: quando o worker existir, o que muda é quem executa — o registro já está no
 * lugar certo, com o mesmo formato.
 *
 * ── Nunca quebra o chamador ───────────────────────────────────────────────────────────────────
 * Registro é observabilidade. Se o agent-control estiver fora do ar, mal configurado, ou lento, a
 * resposta ao usuário sai do mesmo jeito. Um sistema que derruba a funcionalidade por causa do
 * telemetria dela é pior do que um sem telemetria.
 */

export function registroConfigurado(): boolean {
  return !!(process.env.AGENT_CONTROL_URL && process.env.AGENT_CONTROL_SERVICE_KEY);
}

function cliente(): SupabaseClient | null {
  const url = process.env.AGENT_CONTROL_URL;
  const key = process.env.AGENT_CONTROL_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Preço por milhão de tokens. Fonte única — o custo calculado aqui é o que vai ao relatório. */
const PRECO: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5": { entrada: 15, saida: 75 },
  "claude-sonnet-5": { entrada: 3, saida: 15 },
  "claude-haiku-4-5-20251001": { entrada: 1, saida: 5 },
};

export function custoUsd(modelo: string | null, entrada: number, saida: number): number | null {
  if (!modelo) return null;
  const p = PRECO[modelo] ?? Object.entries(PRECO).find(([k]) => modelo.startsWith(k.slice(0, 13)))?.[1];
  if (!p) return null;
  return Number((((entrada * p.entrada) + (saida * p.saida)) / 1_000_000).toFixed(6));
}

export type RegistroExecucao = {
  agentKey: string;
  orgId?: string | null;
  entrada: unknown;
  saida?: unknown;
  erro?: string | null;
  modelo?: string | null;
  tokensEntrada?: number;
  tokensSaida?: number;
  latenciaMs?: number;
  /** Mesma chave = mesma execução. Um retry de rede não vira custo dobrado no relatório. */
  idempotencia?: string | null;
};

/**
 * Grava a execução. Devolve o id do run, ou null quando não deu — e não deu é aceitável.
 *
 * A entrada é TRUNCADA antes de sair daqui: prompts carregam contexto do cliente, e um traço de
 * execução não precisa de uma cópia integral disso em outro banco. Guardar o começo basta para
 * diagnosticar; guardar tudo transforma a tabela de traço num segundo lugar onde dado de cliente
 * mora — com outras políticas de acesso e outra superfície de vazamento.
 */
export async function registrarExecucao(r: RegistroExecucao): Promise<string | null> {
  const sb = cliente();
  if (!sb) return null;

  try {
    const entrada = r.tokensEntrada ?? 0;
    const saida = r.tokensSaida ?? 0;
    const { data, error } = await sb.from("agent_runs").insert({
      agent_key: r.agentKey,
      org_id: r.orgId ?? null,
      origem: "ai-os",
      trigger_type: "api",
      status: r.erro ? "failed" : "succeeded",
      input: truncar(r.entrada),
      output: r.erro ? null : truncar(r.saida),
      error: r.erro ?? null,
      model: r.modelo ?? null,
      tokens_input: entrada,
      tokens_output: saida,
      cost_usd: custoUsd(r.modelo ?? null, entrada, saida),
      idempotency_key: r.idempotencia ?? null,
      started_at: r.latenciaMs ? new Date(Date.now() - r.latenciaMs).toISOString() : new Date().toISOString(),
      finished_at: new Date().toISOString(),
    }).select("id").single();

    if (error) {
      // Chave duplicada é sucesso disfarçado: a execução já estava registrada.
      if (/duplicate|unique/i.test(error.message)) return null;
      console.error("[agent-control] registro falhou:", error.message);
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.error("[agent-control] registro indisponível:", (e as Error).message);
    return null;
  }
}

/** Corta o que for grande demais. Traço serve para diagnosticar, não para arquivar conversa. */
function truncar(v: unknown, limite = 4000): unknown {
  if (v == null) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length <= limite
    ? (typeof v === "string" ? { texto: v } : v)
    : { texto: s.slice(0, limite), truncado: true, tamanho_original: s.length };
}

export type CustoPorOrg = {
  orgId: string; execucoes: number; tokensEntrada: number; tokensSaida: number;
  custoUsd: number; ultima: string | null;
};

/** Quanto de IA cada cliente consumiu. A pergunta que a fatura da Anthropic não responde. */
export async function custoPorOrg(): Promise<CustoPorOrg[]> {
  const sb = cliente();
  if (!sb) return [];
  try {
    const { data } = await sb.from("custo_ia_por_org").select("*");
    return (data ?? []).map((r) => ({
      orgId: r.org_id as string,
      execucoes: Number(r.execucoes), tokensEntrada: Number(r.tokens_entrada ?? 0),
      tokensSaida: Number(r.tokens_saida ?? 0), custoUsd: Number(r.custo_usd ?? 0),
      ultima: r.ultima_execucao as string | null,
    }));
  } catch {
    return [];
  }
}

export type ExecucaoLinha = {
  id: string; agentKey: string | null; orgId: string | null; status: string;
  modelo: string | null; tokens: number; custoUsd: number | null;
  erro: string | null; quando: string; duracaoMs: number | null;
};

export async function execucoesRecentes(limite = 50): Promise<ExecucaoLinha[]> {
  const sb = cliente();
  if (!sb) return [];
  try {
    const { data } = await sb.from("agent_runs")
      .select("id, agent_key, org_id, status, model, tokens_input, tokens_output, cost_usd, error, created_at, started_at, finished_at")
      .eq("origem", "ai-os").order("created_at", { ascending: false }).limit(limite);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      agentKey: r.agent_key as string | null,
      orgId: r.org_id as string | null,
      status: r.status as string,
      modelo: r.model as string | null,
      tokens: Number(r.tokens_input ?? 0) + Number(r.tokens_output ?? 0),
      custoUsd: r.cost_usd == null ? null : Number(r.cost_usd),
      erro: r.error as string | null,
      quando: r.created_at as string,
      duracaoMs: r.started_at && r.finished_at
        ? new Date(r.finished_at as string).getTime() - new Date(r.started_at as string).getTime()
        : null,
    }));
  } catch {
    return [];
  }
}
