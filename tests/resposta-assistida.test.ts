import { describe, it, expect, vi } from "vitest";

/**
 * A resposta assistida tem uma promessa só, e ela é fácil de quebrar sem ninguém notar: o agente
 * prepara, a pessoa envia. Estes testes protegem os dois pontos onde essa promessa se perderia em
 * silêncio — o gatilho que teria dois donos, e a decisão que se registraria como acerto sem ter sido.
 */

// `lib/agents/gatilhos` importa server-only e o cliente de serviço; nenhum dos dois pode subir aqui.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => { throw new Error("o gatilho não deveria ter tocado no banco"); },
}));
vi.mock("@/lib/agents/runner", () => ({ runAgentCore: async () => ({ text: "", tokens: 0, degraded: true, model: null }) }));

const { GATILHOS, dispararGatilho } = await import("@/lib/agents/gatilhos");

describe("gatilho de mensagem recebida", () => {
  it("está no catálogo — senão a tela de Agentes mostra uma chave crua ao operador", () => {
    expect(GATILHOS).toHaveProperty("mensagem_recebida");
    expect(GATILHOS.mensagem_recebida.rotulo).toMatch(/mensagem/i);
  });

  it("promete, no texto que o operador lê, que nada sai sem aprovação", () => {
    expect(GATILHOS.mensagem_recebida.descricao).toMatch(/aprovar|aprovação/i);
  });

  it("NÃO passa pelo despachante genérico — dois donos gerariam dois textos para a mesma mensagem", async () => {
    // O mock do banco lança se for tocado; o teste passa justamente porque isso não acontece.
    await expect(dispararGatilho("mensagem_recebida", { qualquer: "coisa" })).resolves.toBeUndefined();
  });

  it("os demais gatilhos continuam passando por ele", async () => {
    // Aqui o banco É tocado — e o `dispararGatilho` engole o erro de propósito, para nunca
    // bloquear quem o chamou. O que se prova é que ele TENTOU, ao contrário do caso acima.
    const erros: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => { erros.push(a); });
    await dispararGatilho("lead_novo", { nome: "Teste" });
    spy.mockRestore();
    expect(erros.length).toBeGreaterThan(0);
  });
});

const { classificarDecisao: classificar } = await import("@/lib/relacionamento/sugestao");

describe("como a decisão é classificada", () => {
  it("texto idêntico é acerto", () => {
    expect(classificar("Bom dia! Já te retorno.", "Bom dia! Já te retorno.")).toBe("aprovada");
  });

  it("espaço no começo ou no fim não conta como edição", () => {
    expect(classificar("Bom dia!", "  Bom dia!\n")).toBe("aprovada");
  });

  it("qualquer mudança real conta como edição", () => {
    expect(classificar("Bom dia! Já te retorno.", "Bom dia! Retorno até as 15h.")).toBe("editada");
  });

  it("uma palavra trocada já é edição — é o sinal mais barato de prompt desafinado", () => {
    expect(classificar("Confirmo o valor de R$ 5.000.", "Confirmo o valor combinado.")).toBe("editada");
  });
});
