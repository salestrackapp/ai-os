import { describe, it, expect } from "vitest";
import { currentStage, stageStatus, nextStage, journeyProgress, isStageOverdue, nextAction, seedStates, JOURNEY_STAGES, TOTAL_STAGES, type StageState } from "@/lib/journey/stages";

const NOW = "2026-07-13T12:00:00.000Z";

describe("U1 · Jornada de Transformação (lógica pura)", () => {
  it("6 etapas fixas na ordem certa", () => {
    expect(TOTAL_STAGES).toBe(6);
    expect(JOURNEY_STAGES.map((s) => s.key)).toEqual(["captar", "diagnostico", "construcao", "golive", "sprint", "recorrencia"]);
  });

  it("etapa atual = a que está 'fazendo'", () => {
    const st = seedStates(2, NOW);
    expect(currentStage(st)).toBe(2);
    expect(stageStatus(st, 1)).toBe("concluido");
    expect(stageStatus(st, 2)).toBe("fazendo");
    expect(stageStatus(st, 3)).toBe("pendente");
  });

  it("etapa atual sem 'fazendo' = primeira pendente após as concluídas", () => {
    const st: StageState[] = [
      { etapa: 1, status: "concluido" }, { etapa: 2, status: "concluido" },
      { etapa: 3, status: "pendente" }, { etapa: 4, status: "pendente" },
      { etapa: 5, status: "pendente" }, { etapa: 6, status: "pendente" },
    ];
    expect(currentStage(st)).toBe(3);
  });

  it("próxima etapa e progresso", () => {
    expect(nextStage(2)).toBe(3);
    expect(nextStage(6)).toBe(null);
    expect(journeyProgress(seedStates(3, NOW))).toBe(Math.round((2 / 6) * 100)); // 2 concluídas
    expect(journeyProgress(seedStates(1, NOW))).toBe(0);
  });

  it("SLA: etapa 'fazendo' parada além do limiar acende", () => {
    // parada há 3 dias, SLA 48h → atrasada
    expect(isStageOverdue({ status: "fazendo", updated_at: "2026-07-10T12:00:00.000Z" }, 48, NOW)).toBe(true);
    // parada há 6h → dentro do SLA
    expect(isStageOverdue({ status: "fazendo", updated_at: "2026-07-13T06:00:00.000Z" }, 48, NOW)).toBe(false);
    // etapa pendente nunca atrasa
    expect(isStageOverdue({ status: "pendente", updated_at: "2026-01-01T00:00:00.000Z" }, 48, NOW)).toBe(false);
  });

  it("próxima ação: usa a definida, senão o padrão da etapa", () => {
    const st = seedStates(2, NOW);
    expect(nextAction(st).acao).toBe("Enviar o link do diagnóstico"); // padrão da etapa 2
    st[1].next_action = "Reenviar link ao Darlucio";
    expect(nextAction(st).acao).toBe("Reenviar link ao Darlucio");
    expect(nextAction(st).etapa).toBe(2);
  });
});
