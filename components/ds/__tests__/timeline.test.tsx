import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { currentPhaseIndex, phaseStatusAt, cycleStepOf, type TimelinePhase } from "@/lib/timeline/position";

const P = (titulo: string, status?: TimelinePhase["status"]): TimelinePhase => ({ n: 0, titulo, meses: 1, descricao: "", status });

describe("Posição do 'você está aqui' (R2.5)", () => {
  it("usa status explícito 'atual' quando existe", () => {
    const phases = [P("A", "concluido"), P("B", "atual"), P("C")];
    expect(currentPhaseIndex(phases, { progress_pct: 0 })).toBe(1);
  });
  it("aponta o próximo após os concluídos", () => {
    const phases = [P("A", "concluido"), P("B", "concluido"), P("C"), P("D")];
    expect(currentPhaseIndex(phases, null)).toBe(2);
  });
  it("deriva do progresso quando não há status", () => {
    const phases = [P("A"), P("B"), P("C"), P("D")];
    expect(currentPhaseIndex(phases, { progress_pct: 50 })).toBe(2);
  });
  it("phaseStatusAt: antes=concluído, no=atual, depois=previsto (quando derivado)", () => {
    const phases = [P("A"), P("B"), P("C")];
    expect(phaseStatusAt(phases, 0, 1)).toBe("concluido");
    expect(phaseStatusAt(phases, 1, 1)).toBe("atual");
    expect(phaseStatusAt(phases, 2, 1)).toBe("previsto");
  });
  it("cycleStepOf usa cycle_step marcado, senão deriva do progresso", () => {
    expect(cycleStepOf({ cycle_step: 2 })).toBe(2);
    expect(cycleStepOf({ progress_pct: 92 })).toBe(4);
    expect(cycleStepOf({ status: "onboarding" })).toBe(0);
  });
});
