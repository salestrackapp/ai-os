import { describe, it, expect } from "vitest";
import { matchesFilter, isSnoozed, isFollowupDue, canTransition, waWindowClosesAt, isWaWindowOpen, canSendWhatsApp, isSlaBreached, STATUS_LABELS, FILTER_LABELS, type ConvStatus } from "@/lib/relacionamento/types";

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

  it("WhatsApp · janela de 24h a partir da última msg recebida (E3)", () => {
    expect(waWindowClosesAt("2026-07-07T06:00:00.000Z")).toBe("2026-07-08T06:00:00.000Z");
    expect(waWindowClosesAt(null)).toBe(null);
    // recebeu há 6h → janela aberta; recebeu há 30h → fechada
    expect(isWaWindowOpen("2026-07-07T06:00:00.000Z", NOW)).toBe(true);
    expect(isWaWindowOpen("2026-07-06T05:00:00.000Z", NOW)).toBe(false);
    expect(isWaWindowOpen(null, NOW)).toBe(false);
  });

  it("WhatsApp · regra de envio: opt-in NÃO bloqueia; só a janela 24h/HSM da Meta (E4 ajustado)", () => {
    // opt-in ausente não trava mais — dentro da janela envia texto livre
    expect(canSendWhatsApp({ optIn: false, windowOpen: true, isHsm: false }).ok).toBe(true);
    expect(canSendWhatsApp({ optIn: true, windowOpen: true, isHsm: false }).ok).toBe(true);
    // fora da janela, sem HSM → bloqueia (regra da Meta, não opt-in)
    expect(canSendWhatsApp({ optIn: true, windowOpen: false, isHsm: false }).ok).toBe(false);
    // fora da janela, com HSM → ok mesmo sem opt-in
    expect(canSendWhatsApp({ optIn: false, windowOpen: false, isHsm: true }).ok).toBe(true);
  });

  it("SLA/aging: aberta/aguardando sem movimento além do limiar (E5)", () => {
    // aberta há 30h com SLA 24h → atrasada
    expect(isSlaBreached({ status: "aberta", last_message_at: "2026-07-06T06:00:00.000Z" }, 24, NOW)).toBe(true);
    // aberta há 6h → dentro do SLA
    expect(isSlaBreached({ status: "aberta", last_message_at: "2026-07-07T06:00:00.000Z" }, 24, NOW)).toBe(false);
    // respondida/arquivada nunca conta como atrasada
    expect(isSlaBreached({ status: "respondida", last_message_at: "2026-07-01T06:00:00.000Z" }, 24, NOW)).toBe(false);
    expect(isSlaBreached({ status: "aberta", last_message_at: null }, 24, NOW)).toBe(false);
  });

  it("rótulos legíveis (sem chave crua)", () => {
    (["aberta", "aguardando", "respondida", "arquivada"] as ConvStatus[]).forEach((s) => expect(STATUS_LABELS[s].length).toBeGreaterThan(0));
    expect(FILTER_LABELS.nao_atribuidas).toBe("Não atribuídas");
  });
});
