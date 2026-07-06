/**
 * Posição do "você está aqui" no programa — UM cálculo, reusado em portal, ficha 360 e timeline.
 * Módulo NEUTRO (puro) — importável por server components e testes.
 * Marcos (fases) vêm do timeline jsonb do Programa (R2.2); podem ter status/data explícitos.
 */
export type PhaseStatus = "concluido" | "atual" | "previsto";
export type TimelinePhase = { n: number; titulo: string; meses: number; descricao: string; status?: PhaseStatus; occurred_at?: string | null; planned_for?: string | null };
export type ProgramLike = { progress_pct?: number | null; cycle_step?: number | null; status?: string | null };

/** Índice do marco ATUAL. Prioridade: status explícito 'atual' → próximo após concluídos → derivado do progresso. */
export function currentPhaseIndex(phases: TimelinePhase[], project: ProgramLike | null): number {
  if (!phases.length) return -1;
  const atual = phases.findIndex((p) => p.status === "atual");
  if (atual >= 0) return atual;
  const done = phases.filter((p) => p.status === "concluido").length;
  if (done > 0) return Math.min(done, phases.length - 1);
  const pct = project?.progress_pct ?? 0;
  return Math.min(phases.length - 1, Math.max(0, Math.floor((pct / 100) * phases.length)));
}

/** Status efetivo de um marco (explícito, senão derivado da posição atual). */
export function phaseStatusAt(phases: TimelinePhase[], i: number, current: number): PhaseStatus {
  const explicit = phases[i]?.status;
  if (explicit) return explicit;
  return i < current ? "concluido" : i === current ? "atual" : "previsto";
}

/** Passo do ciclo (0–4) do AI Operating Method — mesmo cálculo do portal/ficha. */
export function cycleStepOf(project: ProgramLike | null): number {
  if (!project) return 0;
  if (typeof project.cycle_step === "number") return Math.max(0, Math.min(4, project.cycle_step));
  if (project.status === "onboarding") return 0;
  const pct = project.progress_pct ?? 0;
  return pct < 20 ? 0 : pct < 40 ? 1 : pct < 60 ? 2 : pct < 80 ? 3 : 4;
}
