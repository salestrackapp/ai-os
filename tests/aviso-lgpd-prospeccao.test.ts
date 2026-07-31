import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => { throw new Error("não deveria tocar no banco"); } }));
vi.mock("@/lib/agents/runner", () => ({ runAgentCore: async () => ({ text: "", tokens: 0, degraded: true, model: null }), anthropicConfigured: () => false }));
vi.mock("@/lib/google", () => ({ sendGmail: async () => ({ sent: false }), googleConfigured: async () => false }));
vi.mock("@/lib/whatsapp", () => ({ sendToContact: async () => ({ sent: false }) }));

const { deveEscreverRodape } = await import("@/lib/prospecting/agents");
const { deveCarimbarAviso: deveCarimbar } = await import("@/lib/prospecting/cadence");

/**
 * Quando o prospect passa a contar como "avisado".
 *
 * ── O defeito que estes testes travam ─────────────────────────────────────────────────────────
 * O rodapé de transparência (art. 9º da LGPD) é escrito no rascunho para que quem revisa veja o que
 * a pessoa vai receber. A versão anterior carimbava `aviso_em` NESSE momento. Como todo rascunho
 * passa por uma fila e pode ser reprovado, bastava descartar um para o prospect ficar marcado como
 * avisado sem ter recebido nada — e o contato seguinte, o de verdade, sairia sem o aviso.
 *
 * O trecho de banco não cabe num teste unitário, mas a REGRA cabe, e é ela que se quebra sozinha
 * numa refatoração distraída: escrever o rodapé é uma decisão, carimbar é outra.
 */

const COLETADO = { procedencia: "coleta_publica", email: "ariano@paxsilva.com.br", avisoEm: null };

describe("rodapé de transparência no primeiro toque", () => {
  it("prospect de coleta pública, ainda não avisado, recebe o rodapé", () => {
    expect(deveEscreverRodape(COLETADO)).toBe(true);
  });

  it("quem já foi avisado de verdade não recebe de novo — repetir vira ruído", () => {
    expect(deveEscreverRodape({ ...COLETADO, avisoEm: "2026-07-30T12:00:00Z" })).toBe(false);
  });

  it("sem e-mail não há rodapé — não há para onde mandar a via de oposição", () => {
    expect(deveEscreverRodape({ ...COLETADO, email: null })).toBe(false);
  });

  it("quem chegou por inbound não leva o rodapé de coleta — a procedência é outra", () => {
    expect(deveEscreverRodape({ ...COLETADO, procedencia: "inbound" })).toBe(false);
  });

  it("dado vindo de terceiro conta como coleta", () => {
    expect(deveEscreverRodape({ ...COLETADO, procedencia: "terceiro" })).toBe(true);
  });
});

describe("quando o aviso passa a valer", () => {
  it("mensagem enviada de verdade carimba", () => {
    expect(deveCarimbar({ enviado: true, manual: false, avisoEm: null })).toBe(true);
  });

  it("RASCUNHO REPROVADO NÃO CARIMBA — é o defeito que originou este arquivo", () => {
    expect(deveCarimbar({ enviado: false, manual: false, avisoEm: null })).toBe(false);
  });

  it("aprovada sem canal configurado não carimba: ninguém sabe se foi copiada e enviada", () => {
    expect(deveCarimbar({ enviado: false, manual: true, avisoEm: null })).toBe(false);
  });

  it("quem já tinha aviso não é recarimbado — a data do primeiro contato é a que importa", () => {
    expect(deveCarimbar({ enviado: true, manual: false, avisoEm: "2026-07-01T10:00:00Z" })).toBe(false);
  });

  /**
   * A invariante que amarra as duas metades: enquanto o carimbo não existe, o rodapé continua
   * saindo. Errar para o lado de repetir o aviso é barato; errar para o outro derruba a base legal.
   */
  it("enquanto não carimba, todo rascunho novo continua trazendo o rodapé", () => {
    const p = { ...COLETADO };
    expect(deveEscreverRodape(p)).toBe(true);
    expect(deveCarimbar({ enviado: false, manual: false, avisoEm: p.avisoEm })).toBe(false);
    expect(deveEscreverRodape(p)).toBe(true);
  });
});
