import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => { throw new Error("não deveria tocar no banco"); } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("não deveria tocar no banco"); } }));
vi.mock("@/lib/google", () => ({ googleConfigured: async () => false, sendGmail: async () => ({ sent: false }) }));
vi.mock("@/lib/whatsapp", () => ({ canalWhatsApp: () => ({}), zapiConfigured: async () => false }));
vi.mock("@/lib/studio/render/email", () => ({ buildEmailHtml: () => "" }));
vi.mock("@/lib/lgpd/consentimento", () => ({ linkDescadastro: async () => null, podeEnviarMarketing: async () => false }));

const { quandoEnviar, isDue } = await import("@/lib/comms/orchestrate");
const { diagnosticarPasso, DEFAULT_REGUA_STEPS } = await import("@/lib/comms/regua");

/**
 * A régua nunca rodou — comm_queue, comms_consent e comms_delivery com zero linhas. Estes testes
 * travam os quatro defeitos que só apareceram quando alguém leu o motor com a régua padrão do lado.
 */

describe("quando o passo sai", () => {
  const REF = "2026-08-10T12:00:00Z";

  it("offset de 7 dias soma 7 dias — antes saía na hora, porque ninguém escrevia scheduled_for", () => {
    const saida = quandoEnviar({ tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 7 }, REF);
    expect(saida.slice(0, 10)).toBe("2026-08-17");
  });

  it("offset zero sai na data de referência", () => {
    expect(quandoEnviar({ tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 0 }, REF).slice(0, 10)).toBe("2026-08-10");
  });

  it("data fixa manda na data escolhida, não em cima do gatilho", () => {
    expect(quandoEnviar({ tipo: "tempo", quando: "data_fixa", data: "2026-09-01" }, REF).slice(0, 10)).toBe("2026-09-01");
  });

  it("gatilho de evento sai imediatamente — o evento JÁ é o momento", () => {
    expect(quandoEnviar({ tipo: "evento", evento: "entregavel_aprovado" }, REF).slice(0, 10)).toBe("2026-08-10");
  });

  it("sem data de referência, cai para agora em vez de nunca", () => {
    const antes = Date.now();
    const t = new Date(quandoEnviar({ tipo: "evento", evento: "sessao_agendada" })).getTime();
    expect(t).toBeGreaterThanOrEqual(antes - 1000);
  });
});

describe("o que a tela avisa sobre cada passo", () => {
  it("inatividade agora dispara — e a tela explica o que conta como atividade", () => {
    const avisos = diagnosticarPasso({
      gatilho: { tipo: "estado", condicao: "inatividade", dias_limite: 10 },
      asset_type: "email", publico: "cliente",
    });
    expect(avisos.some((a) => a.grave)).toBe(false);
    expect(avisos.some((a) => /nunca teve atividade nenhuma não é cobrado/.test(a.texto))).toBe(true);
  });

  it("baixo engajamento continua sem avaliação, e isso é dito como aviso grave", () => {
    const avisos = diagnosticarPasso({
      gatilho: { tipo: "estado", condicao: "baixo_engajamento", limiar: 30 },
      asset_type: "email", publico: "cliente",
    });
    expect(avisos.some((a) => a.grave && /nunca vai disparar/.test(a.texto))).toBe(true);
  });

  it("material que não é canal de envio é sinalizado", () => {
    const avisos = diagnosticarPasso({
      gatilho: { tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 7 },
      asset_type: "relatorio", publico: "cliente",
    });
    expect(avisos.some((a) => a.grave && /não é um canal de envio/.test(a.texto))).toBe(true);
  });

  it("público admin avisa que a régua não fala com a equipe Salestrack", () => {
    const avisos = diagnosticarPasso({
      gatilho: { tipo: "evento", evento: "programa_provisionado" }, asset_type: "email", publico: "admin",
    });
    expect(avisos.some((a) => a.grave)).toBe(true);
  });

  it("público cliente explica que NÃO vai para a equipe toda — a diferença que o motor ignorava", () => {
    const avisos = diagnosticarPasso({
      gatilho: { tipo: "evento", evento: "programa_provisionado" }, asset_type: "email", publico: "cliente",
    });
    expect(avisos.some((a) => !a.grave && /patrocinador/.test(a.texto))).toBe(true);
  });

  it("passo comum de e-mail para a equipe do cliente não gera aviso grave", () => {
    const avisos = diagnosticarPasso({
      gatilho: { tipo: "evento", evento: "entregavel_aprovado" }, asset_type: "email", publico: "equipe_cliente",
    });
    expect(avisos.filter((a) => a.grave)).toHaveLength(0);
  });
});

/**
 * A régua PADRÃO é a que todo programa novo recebe. Se ela nasce com passos que nunca disparam, o
 * defeito se multiplica por cliente — daí valer uma asserção sobre ela e não só sobre casos soltos.
 */
describe("a régua padrão, auditada", () => {
  /**
   * Foi este teste que mostrou o problema: escrevi esperando que nenhum passo de envio da régua
   * padrão tivesse gatilho não suportado, e ele falhou apontando "Reengajar se inativo". A resposta
   * certa não era relaxar a asserção — era implementar o gatilho.
   */
  it("todo passo de ENVIO da régua padrão tem gatilho que o motor sabe avaliar", () => {
    const disparaveis = DEFAULT_REGUA_STEPS.filter((s) => ["email", "whatsapp", "mensagem"].includes(s.asset_type));
    expect(disparaveis.length).toBeGreaterThan(0);
    for (const s of disparaveis) {
      expect(diagnosticarPasso(s).filter((a) => a.grave), s.titulo).toHaveLength(0);
    }
  });

  it("o único aviso grave que sobra é do passo de relatório, que não é canal de envio", () => {
    const graves = DEFAULT_REGUA_STEPS.filter((s) => diagnosticarPasso(s).some((a) => a.grave));
    expect(graves.map((s) => s.titulo)).toEqual(["Recapitulação de resultados"]);
  });
});

describe("quem conta como inativo", () => {
  const passo = { cycle_step: 0, gatilho: { tipo: "estado", condicao: "inatividade", dias_limite: 10 } as const };

  it("sumido há mais dias que o limite dispara", () => {
    expect(isDue(passo, { cycle_step: 0, diasInativo: 14 })).toBe(true);
  });

  it("ativo esta semana não dispara", () => {
    expect(isDue(passo, { cycle_step: 0, diasInativo: 3 })).toBe(false);
  });

  it("exatamente no limite dispara — o limite é inclusivo", () => {
    expect(isDue(passo, { cycle_step: 0, diasInativo: 10 })).toBe(true);
  });

  /**
   * A regra que evita o pior erro possível hoje: o Portal tem ZERO acessos. Sem ela, ligar o
   * gatilho enfileiraria um "sentimos sua falta" para a base inteira de uma só vez.
   */
  it("quem NUNCA teve atividade não é cobrado — não é o mesmo que ter sumido", () => {
    expect(isDue(passo, { cycle_step: 0, diasInativo: null })).toBe(false);
    expect(isDue(passo, { cycle_step: 0 })).toBe(false);
  });
});
