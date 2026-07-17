/** Jornada de Transformação (U1) — modelo das 6 etapas + lógica PURA (testável, sem server-only). */

export type JourneyStageKey = "captar" | "diagnostico" | "construcao" | "golive" | "sprint" | "recorrencia";
export type StageStatus = "pendente" | "fazendo" | "concluido";

export type StageState = {
  etapa: number;
  status: StageStatus;
  next_action?: string | null;
  owner?: string | null;
  done_at?: string | null;
  updated_at?: string | null;
};

export type StageDef = { etapa: number; key: JourneyStageKey; titulo: string; ancora: string; acaoPadrao: string };

/** As 6 etapas fixas = entregas Fase 1 da Salestrack. */
export const JOURNEY_STAGES: StageDef[] = [
  { etapa: 1, key: "captar", titulo: "Captar", ancora: "Contato + oferta", acaoPadrao: "Confirmar contato e oferta" },
  { etapa: 2, key: "diagnostico", titulo: "Diagnóstico", ancora: "Formulário preenchido", acaoPadrao: "Enviar o link do diagnóstico" },
  { etapa: 3, key: "construcao", titulo: "Construção", ancora: "Site, Agente IA, agenda, domínio", acaoPadrao: "Produzir e aprovar os entregáveis" },
  { etapa: 4, key: "golive", titulo: "Go-live", ancora: "No ar e compartilhado", acaoPadrao: "Publicar e avisar o cliente" },
  { etapa: 5, key: "sprint", titulo: "Sprint 30 dias", ancora: "4 sessões, ajustes, adoção", acaoPadrao: "Agendar a próxima sessão" },
  { etapa: 6, key: "recorrencia", titulo: "Recorrência", ancora: "Manutenção + ROI", acaoPadrao: "Enviar o ROI do mês" },
];

export const STAGE_LABELS: Record<number, string> = Object.fromEntries(JOURNEY_STAGES.map((s) => [s.etapa, s.titulo]));

/** Rótulos das etapas na linguagem do cliente (portal). */
export const STAGE_CLIENTE: Record<number, string> = {
  1: "Contratado", 2: "Diagnóstico", 3: "Construção", 4: "No ar", 5: "Acompanhamento", 6: "Recorrência",
};
export const STAGE_BY_ETAPA = (etapa: number): StageDef | undefined => JOURNEY_STAGES.find((s) => s.etapa === etapa);
export const TOTAL_STAGES = JOURNEY_STAGES.length; // 6

/** Etapa atual (puro): a que está "fazendo"; senão a 1ª "pendente" após as concluídas; senão a última. */
export function currentStage(states: StageState[]): number {
  const fazendo = states.find((s) => s.status === "fazendo");
  if (fazendo) return fazendo.etapa;
  const concluidas = states.filter((s) => s.status === "concluido").map((s) => s.etapa);
  const maxConcluida = concluidas.length ? Math.max(...concluidas) : 0;
  const prox = states.filter((s) => s.status === "pendente" && s.etapa > maxConcluida).sort((a, b) => a.etapa - b.etapa)[0];
  return prox?.etapa ?? (maxConcluida || 1);
}

/** Status de uma etapa (puro). */
export function stageStatus(states: StageState[], etapa: number): StageStatus {
  return states.find((s) => s.etapa === etapa)?.status ?? "pendente";
}

/** Próxima etapa (puro) — null se já na última. */
export function nextStage(current: number): number | null {
  return current >= 1 && current < TOTAL_STAGES ? current + 1 : null;
}

/** Progresso da jornada em % (puro) — etapas concluídas sobre o total. */
export function journeyProgress(states: StageState[]): number {
  const done = states.filter((s) => s.status === "concluido").length;
  return Math.round((done / TOTAL_STAGES) * 100);
}

/** Etapa atrasada pelo SLA (puro): está "fazendo" há mais de slaHoras. */
export function isStageOverdue(state: Pick<StageState, "status" | "updated_at">, slaHoras: number, nowISO: string): boolean {
  if (state.status !== "fazendo" || !state.updated_at) return false;
  const idadeMs = new Date(nowISO).getTime() - new Date(state.updated_at).getTime();
  return idadeMs > slaHoras * 3600 * 1000;
}

/** A ÚNICA próxima ação da jornada (puro): a ação da etapa atual, ou o padrão dessa etapa. */
export function nextAction(states: StageState[]): { etapa: number; titulo: string; acao: string } {
  const cur = currentStage(states);
  const def = STAGE_BY_ETAPA(cur);
  const st = states.find((s) => s.etapa === cur);
  const acao = (st?.next_action && st.next_action.trim()) || def?.acaoPadrao || "Avançar a jornada";
  return { etapa: cur, titulo: def?.titulo ?? `Etapa ${cur}`, acao };
}

/** Cria os 6 estados-semente com uma etapa "fazendo" (puro; usado no seed/backfill). */
export function seedStates(etapaAtual: number, nowISO: string): StageState[] {
  return JOURNEY_STAGES.map((s) => ({
    etapa: s.etapa,
    status: s.etapa < etapaAtual ? "concluido" : s.etapa === etapaAtual ? "fazendo" : "pendente",
    done_at: s.etapa < etapaAtual ? nowISO : null,
    updated_at: nowISO,
  }));
}
