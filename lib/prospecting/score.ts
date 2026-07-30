import type { ProspectAccount, Prospect } from "./types";

/**
 * Score mínimo de ICP para entrar em cadência — a "regra de ouro" do funil (sinal, não volume).
 * Valores iniciais conservadores; calibrar com dados reais.
 */
export const SCORE_MIN: Record<string, number> = { icp1: 60, icp2: 55, icp3: 60 };
export const DEFAULT_SCORE_MIN = 60;

export function scoreMinFor(icp: string | null | undefined): number {
  if (icp && SCORE_MIN[icp] != null) return SCORE_MIN[icp];
  return DEFAULT_SCORE_MIN;
}

/** Mínimo do ICP via store (app → env → default). Import dinâmico p/ não puxar server-only ao grafo do módulo. */
export async function scoreMinForLive(icp: string | null | undefined): Promise<number> {
  const key = icp === "icp1" ? "score_min_icp1" : icp === "icp2" ? "score_min_icp2" : icp === "icp3" ? "score_min_icp3" : null;
  const fallback = scoreMinFor(icp);
  if (!key) return fallback;
  try {
    const { getSetting } = await import("@/lib/settings/resolve");
    const v = Number(await getSetting(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch { return fallback; }
}

/** Portão do funil com mínimos do store. Usado pelo motor de cadências (servidor). */
export async function canEnrollLive(prospect: Pick<Prospect, "score" | "icp">): Promise<{ ok: boolean; min: number }> {
  const min = await scoreMinForLive(prospect.icp);
  return { ok: (prospect.score ?? 0) >= min, min };
}

/**
 * Score 0–100 de um prospect: fit de ICP (cargo/senioridade) + sinais da conta + completude.
 *
 * Isto é FIT — quem a pessoa é. Não diz nada sobre interesse. O interesse mora em
 * `prospects.engajamento`, alimentado pelos sinais de primeira parte (abriu, clicou, leu a
 * proposta). Os dois ficam separados de propósito: um diretor de operações numa indústria de 300
 * pessoas tem fit alto no dia em que entra na base e continua tendo daqui a um ano; se ele abriu
 * a proposta ontem, isso é outra informação, e some sozinha se ele parar de responder.
 *
 * Misturar os dois num número só esconderia qual dos dois está sustentando a nota — e a fila de
 * abordagem seria ordenada por um valor que ninguém sabe ler. `prioridade()` combina os dois
 * quando é hora de decidir a quem falar primeiro.
 */
export function scoreProspect(prospect: Partial<Prospect>, account?: Partial<ProspectAccount> | null): number {
  const t = (prospect.title ?? "").toLowerCase();
  const sen = (prospect.seniority ?? "").toLowerCase();
  const blob = `${t} ${sen}`;
  let s = 0;

  // Senioridade
  if (/found|ceo|s[oó]cio|owner|presidente|c-level|cfo|coo|cto|chief/.test(blob)) s += 40;
  else if (/vp|head|diretor|director/.test(blob)) s += 32;
  else if (/gerente|manager|coordenad|lead|supervisor/.test(blob)) s += 20;
  else s += 6;

  // Fit do cargo com o ICP
  const icp = prospect.icp ?? account?.icp ?? null;
  if (icp === "icp1" && /found|ceo|s[oó]cio|owner|presidente/.test(t)) s += 20;
  if (icp === "icp2" && /vendas|comercial|marketing|growth|sales|receita|revenue/.test(t)) s += 20;
  if (icp === "icp3" && /opera|finan|coo|cfo|controlad|supply|log[ií]stic/.test(t)) s += 20;

  // Sinais da conta (gatilhos): contratação, rodada, notícia, cargo novo, tecnologia
  const sig = Array.isArray(account?.signals) ? account!.signals!.length : 0;
  s += Math.min(24, sig * 8);

  // Completude de contato
  if (prospect.email) s += 8;
  if (prospect.linkedin_url) s += 4;

  return Math.max(0, Math.min(100, Math.round(s)));
}

/** Score simples de uma conta-alvo (sinais + dados). */
export function scoreAccount(a: Partial<ProspectAccount>): number {
  const sig = Array.isArray(a.signals) ? a.signals.length : 0;
  let s = Math.min(40, sig * 12);
  if (a.icp) s += 20;
  if (a.size) s += 10;
  if (a.industry) s += 6;
  if (a.domain) s += 6;
  return Math.max(0, Math.min(100, s));
}

/**
 * A quem falar primeiro. Fit diz se vale a pena; engajamento diz se é agora.
 *
 * O engajamento pesa mais (60/40) porque fit alto sem nenhum sinal é uma hipótese, enquanto um
 * clique é um fato. Quem tem fit médio e acabou de abrir a agenda merece a ligação antes do
 * diretor perfeito que nunca abriu nada.
 *
 * Quem se descadastrou tem engajamento negativo e cai para o fim da fila sozinho — sem precisar
 * de uma regra separada para excluí-lo.
 */
export function prioridade(fit: number, engajamento: number): number {
  return Math.max(0, Math.min(100, Math.round(fit * 0.4 + Math.max(0, engajamento) * 0.6)));
}

/** Faixa legível da prioridade — a tela mostra isto, não o número cru. */
export function faixaPrioridade(p: number): "quente" | "morno" | "frio" {
  if (p >= 60) return "quente";
  if (p >= 35) return "morno";
  return "frio";
}

/** Portão do funil: pode inscrever em cadência? (score ≥ mínimo do ICP) */
export function canEnroll(prospect: Pick<Prospect, "score" | "icp">): { ok: boolean; min: number } {
  const min = scoreMinFor(prospect.icp);
  return { ok: (prospect.score ?? 0) >= min, min };
}
