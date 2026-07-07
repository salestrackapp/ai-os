import { describe, it, expect } from "vitest";
import { matchesFilter, isSnoozed, isFollowupDue, canTransition, STATUS_LABELS, FILTER_LABELS, type ConvStatus } from "@/lib/relacionamento/types";

const ME = "user-1";
const NOW = "2026-07-07T12:00:00.000Z";

describe("E0 · Relacionamento — modelo da inbox (lógica pura)", () => {
  it("filtro minhas/não-atribuídas/todas", () => {
    const minha = { assigned_to: ME };
    const outra = { assigned_to: "user-2" };
    const semDono = { assigned_to: null };
    expect(matchesFilter(minha, "minhas", ME)).toBe(true);
    expect(matchesFilter(outra, "minhas", ME)).toBe(false);
    expect(matchesFilter(semDono, "nao_atribuidas", ME)).toBe(true);
    expect(matchesFilter(minha, "nao_atribuidas", ME)).toBe(false);
    expect(matchesFilter(outra, "todas", ME)).toBe(true);
  });

  it("snooze: adormecida só enquanto a data é futura", () => {
    expect(isSnoozed({ snooze_until: "2026-07-07T18:00:00.000Z" }, NOW)).toBe(true);
    expect(isSnoozed({ snooze_until: "2026-07-07T06:00:00.000Z" }, NOW)).toBe(false);
    expect(isSnoozed({ snooze_until: null }, NOW)).toBe(false);
  });

  it("follow-up vencido: snooze no passado + status aberta/aguardando", () => {
    expect(isFollowupDue({ snooze_until: "2026-07-07T06:00:00.000Z", status: "aberta" }, NOW)).toBe(true);
    expect(isFollowupDue({ snooze_until: "2026-07-07T06:00:00.000Z", status: "arquivada" }, NOW)).toBe(false);
    expect(isFollowupDue({ snooze_until: "2026-07-07T18:00:00.000Z", status: "aberta" }, NOW)).toBe(false);
    expect(isFollowupDue({ snooze_until: null, status: "aberta" }, NOW)).toBe(false);
  });

  it("transições de status: arquivada é terminal (só reabre p/ aberta)", () => {
    expect(canTransition("aberta", "respondida")).toBe(true);
    expect(canTransition("aberta", "aberta")).toBe(false);
    expect(canTransition("arquivada", "aberta")).toBe(true);
    expect(canTransition("arquivada", "respondida")).toBe(false);
  });

  it("rótulos legíveis (sem chave crua)", () => {
    (["aberta", "aguardando", "respondida", "arquivada"] as ConvStatus[]).forEach((s) => expect(STATUS_LABELS[s].length).toBeGreaterThan(0));
    expect(FILTER_LABELS.nao_atribuidas).toBe("Não atribuídas");
  });
});
