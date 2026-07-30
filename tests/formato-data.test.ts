import { describe, it, expect } from "vitest";
import { dataBR, dataHoraBR, diasAte, diasDeAtraso } from "@/lib/formato/data";

/**
 * Estes testes existem por causa de um bug visto na tela: prazo cadastrado como 2026-07-20
 * aparecia como 19/07. `new Date("2026-07-20")` é meia-noite UTC, que em Brasília é o dia
 * anterior às 21h.
 */
describe("Data pura (coluna `date`) não anda para trás", () => {
  it("mostra o dia que foi guardado", () => {
    expect(dataBR("2026-07-20")).toBe("20/07/2026");
    expect(dataBR("2026-01-01")).toBe("01/01/2026");
    expect(dataBR("2026-12-31")).toBe("31/12/2026");
  });

  it("vazio vira travessão, não 'Invalid Date'", () => {
    expect(dataBR(null)).toBe("—");
    expect(dataBR("")).toBe("—");
    expect(dataBR("qualquer coisa")).toBe("—");
  });

  it("timestamp continua sendo formatado como instante", () => {
    const s = dataHoraBR("2026-07-20T14:30:00Z");
    expect(s).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(s).toMatch(/\d{2}:\d{2}/);
  });

  it("data pura no formato longo cai no curto — ela não tem hora", () => {
    expect(dataHoraBR("2026-07-20")).toBe("20/07/2026");
  });
});

describe("Contagem de dias não depende da hora da pergunta", () => {
  it("hoje é zero", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(diasAte(hoje)).toBe(0);
  });

  it("futuro é positivo, passado é negativo", () => {
    const d = (delta: number) =>
      new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
    expect(diasAte(d(5))).toBe(5);
    expect(diasAte(d(-3))).toBe(-3);
  });

  it("atraso só existe quando não foi concluído", () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect(diasDeAtraso(ontem)).toBe(1);
    expect(diasDeAtraso(ontem, "2026-07-30T10:00:00Z")).toBeNull();
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(diasDeAtraso(amanha)).toBeNull();
  });
});

// ── Encargos de mora ──────────────────────────────────────────────────────────
import { encargos, MULTA_PADRAO, FATURAS_PARA_SUSPENDER } from "@/lib/financeiro/cobranca";

describe("Encargos de inadimplência (cláusulas 3.6–3.9)", () => {
  it("a regra vigente é multa de 10% e suspensão após 2 faturas", () => {
    expect(MULTA_PADRAO).toBe(0.10);
    expect(FATURAS_PARA_SUSPENDER).toBe(2);
  });

  it("fatura em dia não tem encargo", () => {
    const e = encargos(1000, 0);
    expect(e.multa).toBe(0);
    expect(e.juros).toBe(0);
    expect(e.total).toBe(1000);
  });

  it("10% de multa + 1% ao mês pro rata", () => {
    const e = encargos(1000, 30);
    expect(e.multa).toBe(100);          // 10%
    expect(e.juros).toBe(10);           // 1% de um mês cheio
    expect(e.total).toBe(1110);
  });

  it("juros são proporcionais aos dias, não ao mês fechado", () => {
    const quinze = encargos(1000, 15);
    const trinta = encargos(1000, 30);
    expect(quinze.juros).toBeCloseTo(trinta.juros / 2, 2);
  });

  it("contrato que pactuou 2% é cobrado a 2% — não a 10%", () => {
    // O da IMAGO. Cobrar a regra nova de quem assinou a antiga é cobrança indevida.
    const e = encargos(3000, 18, 0.02);
    expect(e.multa).toBe(60);
    expect(e.total).toBeLessThan(encargos(3000, 18, 0.10).total);
  });

  it("os valores são arredondados ao centavo", () => {
    const e = encargos(3333.33, 7);
    expect(Number.isInteger(e.multa * 100)).toBe(true);
    expect(Number.isInteger(e.juros * 100)).toBe(true);
  });
});
