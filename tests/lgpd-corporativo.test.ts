import { describe, it, expect } from "vitest";
import { emailCorporativo, telefoneCorporativo, motivoRecusa } from "@/lib/lgpd/corporativo";

/**
 * A regra do dado corporativo existe DUAS vezes: no gatilho do banco (que é a garantia, porque
 * vale para PostgREST direto) e em TypeScript (que é a mensagem ao operador). Divergir seria bug
 * silencioso — uma linha aceita por um e recusada pelo outro. Estes casos são os mesmos usados
 * contra o banco em tests/rls.test.ts.
 */
const CASOS: [string, boolean][] = [
  ["ana.silva@empresa.com.br", true],
  ["contato@construtoraxyz.com", true],
  ["j@ab.co", true],
  ["ana@gmail.com", false],
  ["ANA@GMAIL.COM", false],
  ["ana@hotmail.com.br", false],
  ["ana@uol.com.br", false],
  ["ana@outlook.com", false],
  ["ana@icloud.com", false],
  ["ana@proton.me", false],
  ["ana@terra.com.br", false],
  ["semarroba", false],
  ["@semlocal.com", false],
  ["", false],
];

describe("Dado corporativo · e-mail", () => {
  for (const [email, esperado] of CASOS) {
    it(`${email || "(vazio)"} → ${esperado ? "aceita" : "recusa"}`, () => {
      expect(emailCorporativo(email)).toBe(esperado);
    });
  }
  it("nulo e indefinido são recusa, não exceção", () => {
    expect(emailCorporativo(null)).toBe(false);
    expect(emailCorporativo(undefined)).toBe(false);
  });
});

describe("Dado corporativo · telefone não é filtrado (decisão de 2026-07-30)", () => {
  it("fixo, celular e ausência: todos passam", () => {
    for (const t of ["(11) 3333-4444", "1133334444", "(11) 98888-7777", "+55 11 98888-7777", "", null]) {
      expect(telefoneCorporativo(t), `recusou ${t ?? "(vazio)"}`).toBe(true);
    }
  });
});

describe("Motivo da recusa é legível para quem importa", () => {
  it("nomeia o provedor, não devolve jargão", () => {
    const m = motivoRecusa("ana@gmail.com");
    expect(m).toContain("gmail.com");
    expect(m).toContain("pessoal");
    expect(m).not.toMatch(/null|undefined|\{|\}/);
  });
  it("dado corporativo não gera motivo — nem com celular", () => {
    expect(motivoRecusa("ana@empresa.com.br", "(11) 3333-4444")).toBeNull();
    expect(motivoRecusa("ana@empresa.com.br", "(11) 98888-7777")).toBeNull();
  });
});

// ── Engajamento ───────────────────────────────────────────────────────────────
import { PESO, ROTULO, type TipoSinal } from "@/lib/prospecting/engajamento";
import { prioridade, faixaPrioridade } from "@/lib/prospecting/score";

describe("Engajamento · pesos e prioridade", () => {
  it("todo tipo de sinal tem peso E rótulo legível — nenhum vaza nome técnico para a tela", () => {
    for (const tipo of Object.keys(PESO) as TipoSinal[]) {
      expect(ROTULO[tipo], `${tipo} sem rótulo humano`).toBeTruthy();
      expect(ROTULO[tipo]).not.toMatch(/_|undefined/);
    }
    expect(Object.keys(ROTULO).sort()).toEqual(Object.keys(PESO).sort());
  });

  it("os pesos respeitam a hierarquia de intenção", () => {
    // Abrir e-mail é quase ruído; clicar é decisão; marcar reunião é a decisão inteira.
    expect(PESO.email_aberto).toBeLessThan(PESO.link_clicado);
    expect(PESO.link_clicado).toBeLessThan(PESO.agenda_aberta);
    expect(PESO.agenda_aberta).toBeLessThan(PESO.respondeu);
    expect(PESO.respondeu).toBeLessThan(PESO.reuniao_marcada);
    expect(PESO.descadastrou).toBeLessThan(0);
  });

  it("engajamento pesa mais que fit — um clique é fato, fit é hipótese", () => {
    const fitAltoSemSinal = prioridade(90, 0);
    const fitMedioEngajado = prioridade(50, 70);
    expect(fitMedioEngajado, "quem demonstrou interesse ficou atrás de quem nunca abriu nada")
      .toBeGreaterThan(fitAltoSemSinal);
  });

  it("quem se descadastrou não sobe na fila por causa do fit", () => {
    expect(prioridade(100, -100)).toBe(40);
    expect(faixaPrioridade(prioridade(100, -100))).toBe("morno");
    // …e com fit comum vira frio de vez.
    expect(faixaPrioridade(prioridade(60, -100))).toBe("frio");
  });

  it("a prioridade nunca sai da faixa 0–100", () => {
    for (const [f, e] of [[0, 0], [100, 100], [100, -100], [0, -100], [50, 50]]) {
      const p = prioridade(f, e);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

// ── Afinidade com o tema de IA ────────────────────────────────────────────────
import { mencoesDeIA, calcularAfinidade, faixaAfinidade } from "@/lib/prospecting/afinidade-ia";
import { slugDoPerfil, parsearColagem } from "@/lib/prospecting/linkedin";

describe("Afinidade com IA · detecção de tema", () => {
  it("reconhece o tema em português e em inglês", () => {
    for (const t of ["Diretor de Inteligência Artificial", "Head of Machine Learning",
                     "Especialista em IA Generativa", "Data Science Manager",
                     "Coordenador de Transformação Digital"]) {
      expect(mencoesDeIA(t), `não reconheceu "${t}"`).toBeGreaterThan(0);
    }
  });

  it("não confunde 'dados' solto com o nosso assunto", () => {
    // "proteção de dados" é jurídico, não é IA — e cair nisso encheria a lista de DPOs.
    expect(mencoesDeIA("Encarregado de Proteção de Dados")).toBe(0);
    expect(mencoesDeIA("Diretor Financeiro")).toBe(0);
    expect(mencoesDeIA("")).toBe(0);
    expect(mencoesDeIA(null)).toBe(0);
  });

  it("'head de dados' conta, porque o qualificador está junto", () => {
    expect(mencoesDeIA("Head de Dados")).toBeGreaterThan(0);
    expect(mencoesDeIA("Engenheiro de Dados")).toBeGreaterThan(0);
  });

  it("comportamento no LinkedIn pesa mais que contexto da empresa", () => {
    const soContexto = calcularAfinidade({
      cargo: "Diretor de Operações",
      vagas: ["Engenheiro de Machine Learning"],
      tecnologias: ["ChatGPT"],
    });
    const comentou = calcularAfinidade({
      cargo: "Diretor de Operações",
      interacoesLinkedIn: { curtidas: 0, comentarios: 2, compartilhamentos: 0 },
    });
    expect(comentou.score, "quem comentou ficou atrás de quem só tem contexto de empresa")
      .toBeGreaterThan(soContexto.score);
  });

  it("todo score vem com motivo em português — número sozinho não prepara conversa", () => {
    const a = calcularAfinidade({
      cargo: "Head of AI",
      interacoesLinkedIn: { curtidas: 1, comentarios: 1, compartilhamentos: 0 },
      vagas: ["Cientista de Dados"],
    });
    expect(a.score).toBeGreaterThan(0);
    expect(a.motivos.length).toBeGreaterThan(0);
    for (const m of a.motivos) expect(m).not.toMatch(/_|undefined|null|\{/);
  });

  it("sem sinal nenhum, score zero e nenhum motivo inventado", () => {
    const a = calcularAfinidade({ cargo: "Diretor Comercial" });
    expect(a.score).toBe(0);
    expect(a.motivos).toHaveLength(0);
    expect(faixaAfinidade(a.score)).toBe("sem sinal");
  });

  it("nunca passa de 100", () => {
    const a = calcularAfinidade({
      cargo: "Chief AI Officer",
      vagas: ["ML Engineer", "Data Scientist", "NLP Engineer", "MLOps"],
      tecnologias: ["ChatGPT", "Copilot", "Machine Learning"],
      descricaoEmpresa: "Plataforma de inteligência artificial",
      interacoesLinkedIn: { curtidas: 9, comentarios: 9, compartilhamentos: 9 },
    });
    expect(a.score).toBeLessThanOrEqual(100);
    expect(faixaAfinidade(a.score)).toBe("dentro do assunto");
  });
});

describe("LinkedIn · casamento por slug e leitura da colagem", () => {
  it("o slug é extraído de qualquer forma de URL do perfil", () => {
    for (const u of ["https://www.linkedin.com/in/alexandreguipereira",
                     "http://linkedin.com/in/alexandreguipereira/",
                     "https://br.linkedin.com/in/alexandreguipereira?originalSubdomain=br"]) {
      expect(slugDoPerfil(u), `falhou em ${u}`).toBe("alexandreguipereira");
    }
    expect(slugDoPerfil(null)).toBeNull();
    expect(slugDoPerfil("")).toBeNull();
  });

  it("lê a lista colada e ignora o ruído da interface", () => {
    const { linhas } = parsearColagem([
      "Ana Prado — Diretora de Operações na Indústria XYZ",
      "Ver perfil",
      "https://www.linkedin.com/in/joaosilva",
      "2º",
      "Carlos Lima - Head of Data at Fintech ABC",
    ].join("\n"));
    expect(linhas.length).toBeGreaterThanOrEqual(3);
    expect(linhas.find((l) => l.nome.startsWith("Ana"))?.empresa).toBe("Indústria XYZ");
    expect(linhas.find((l) => l.nome.startsWith("Carlos"))?.cargo).toContain("Head of Data");
  });

  it("não duplica a mesma pessoa colada duas vezes", () => {
    const { linhas } = parsearColagem("Ana Prado — COO\nAna Prado — COO");
    expect(linhas).toHaveLength(1);
  });

  it("colagem vazia não inventa ninguém", () => {
    const { linhas } = parsearColagem("");
    expect(linhas).toHaveLength(0);
  });
});

describe("Afinidade com IA · casos reais que quebraram a detecção", () => {
  it("reconhece o assunto como as pessoas realmente escrevem", () => {
    // Este primeiro caso é real: chegou numa mensagem e passou batido na primeira versão.
    const reais = [
      "Andre, vi seu post sobre agentes de IA em processos comerciais.",
      "Estamos avaliando usar IA no atendimento",
      "queria falar sobre IA aplicada a vendas",
      "projetos de IA na operação",
      "estamos montando um time de AI agents",
      "automação com IA no financeiro",
      "Head de Dados",
      "Especialista em Analytics",
    ];
    for (const t of reais) {
      expect(mencoesDeIA(t), `não reconheceu: "${t}"`).toBeGreaterThan(0);
    }
  });

  it("continua não confundindo com o que não é o assunto", () => {
    const naoSao = [
      "Parabéns pela palestra! Nada a ver com trabalho, só queria dizer.",
      "Encarregado de Proteção de Dados",
      "Diretor Financeiro",
      "ele ia viajar semana que vem",
      "a reunião ia ser amanhã",
      "Gerente de Vendas",
    ];
    for (const t of naoSao) {
      expect(mencoesDeIA(t), `reconheceu como IA o que não é: "${t}"`).toBe(0);
    }
  });

  it("texto longo repetindo o termo não vence texto curto e preciso", () => {
    const repetido = "ia ia ia inteligência artificial inteligência artificial machine learning machine learning";
    const preciso = "agentes de IA";
    expect(mencoesDeIA(repetido)).toBeLessThanOrEqual(mencoesDeIA(preciso) + 1);
  });

  it("acento não muda o resultado", () => {
    expect(mencoesDeIA("inteligência artificial")).toBe(mencoesDeIA("inteligencia artificial"));
    expect(mencoesDeIA("automação com IA")).toBeGreaterThan(0);
  });
});
