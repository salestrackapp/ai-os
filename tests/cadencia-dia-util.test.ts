import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => { throw new Error("não deveria tocar no banco"); } }));
vi.mock("@/lib/agents/runner", () => ({ runAgentCore: async () => ({ text: "", tokens: 0, degraded: true, model: null }), anthropicConfigured: () => false }));
vi.mock("@/lib/google", () => ({ sendGmail: async () => ({ sent: false }), googleConfigured: async () => false }));
vi.mock("@/lib/whatsapp", () => ({ sendToContact: async () => ({ sent: false }) }));

const { diaUtil } = await import("@/lib/prospecting/cadence");

/**
 * Toque de prospecção não cai em fim de semana.
 *
 * A cadência agenda por deslocamento — dia 0, 2, 4, 6 — e ninguém tinha visto o resultado porque o
 * motor nunca rodou. A prévia da tela mostrou: numa inscrição de sexta, o convite de LinkedIn caía
 * no domingo e a ligação fria no sábado.
 *
 * Datas fixas e conhecidas, não `new Date()` do relógio: um teste que muda de resultado conforme o
 * dia em que roda não prova nada.
 */
const em = (iso: string) => new Date(`${iso}T09:00:00-03:00`);
const dia = (d: Date) => d.toISOString().slice(0, 10);

describe("agendamento em dia útil", () => {
  it("sábado vira segunda", () => {
    expect(dia(diaUtil(em("2026-08-08")))).toBe("2026-08-10");
  });

  it("domingo vira segunda", () => {
    expect(dia(diaUtil(em("2026-08-09")))).toBe("2026-08-10");
  });

  it.each([
    ["2026-08-10", "segunda"], ["2026-08-11", "terça"], ["2026-08-12", "quarta"],
    ["2026-08-13", "quinta"], ["2026-08-14", "sexta"],
  ])("%s (%s) fica onde está", (iso) => {
    expect(dia(diaUtil(em(iso)))).toBe(iso);
  });

  it("empurra sempre PARA FRENTE — antecipar bagunçaria a ordem dos passos", () => {
    for (const iso of ["2026-08-08", "2026-08-09", "2026-08-15", "2026-08-16"]) {
      expect(diaUtil(em(iso)).getTime()).toBeGreaterThanOrEqual(em(iso).getTime());
    }
  });

  it("dois passos de fim de semana seguidos caem no mesmo dia útil — e a ordem se mantém", () => {
    // Sábado e domingo consecutivos viram a mesma segunda. A cadência aperta, não inverte.
    const sab = diaUtil(em("2026-08-08"));
    const dom = diaUtil(em("2026-08-09"));
    expect(dia(sab)).toBe(dia(dom));
    expect(sab.getTime()).toBeLessThanOrEqual(dom.getTime());
  });

  it("é idempotente: aplicar de novo não move mais nada", () => {
    const uma = diaUtil(em("2026-08-08"));
    expect(dia(diaUtil(uma))).toBe(dia(uma));
  });
});
