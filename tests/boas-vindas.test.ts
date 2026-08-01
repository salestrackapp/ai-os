import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * O boas-vindas é o único e-mail de marketing que sai SEM alguém apertar um botão. Por isso as
 * regras que o cercam valem teste: quem NÃO deve receber, e por que ele não pode duplicar.
 */

let suprimido: { email: string } | null = null;
let campanhaAprovada: Record<string, unknown> | null = null;
let insertFalha = false;
const gravado: Record<string, unknown[]> = {};
const enviados: { to: string[]; subject: string; headers?: Record<string, string> }[] = [];

const tabela = (nome: string) => ({
  select: () => ({
    eq: (..._a: unknown[]) => ({
      maybeSingle: async () => ({ data: nome === "email_supressao" ? suprimido : null }),
      eq: () => ({
        is: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: campanhaAprovada }) }) }) }),
      }),
    }),
  }),
  insert: async (v: unknown) => {
    (gravado[nome] ??= []).push(v);
    return { error: insertFalha ? { message: "duplicate key" } : null };
  },
  update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: tabela }) }));
vi.mock("@/lib/audit", () => ({ auditService: async () => {} }));
vi.mock("@/lib/lgpd/consentimento", () => ({
  linkDescadastro: async () => "https://x/descadastro/tok",
  linkDescadastroUmClique: async () => "https://x/api/descadastro/tok",
}));

/**
 * O `fetch` fica trocado durante TODA a suíte e é restaurado em `afterAll`.
 *
 * A primeira versão restaurava no fim do arquivo — que roda ao carregar o módulo, antes de
 * qualquer teste. Resultado: os testes chamavam o fetch de verdade, tentavam falar com a API do
 * Resend e falhavam sem explicar por quê.
 */
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
  enviados.push(JSON.parse(init?.body ?? "{}"));
  return { ok: true, status: 200, json: async () => ({ id: "re_123" }) };
}) as unknown as typeof fetch;

process.env.RESEND_API_KEY = "re_teste";
const { enviarBoasVindas } = await import("@/lib/marketing/boas-vindas");

beforeEach(() => {
  suprimido = null; campanhaAprovada = null; insertFalha = false;
  enviados.length = 0; for (const k of Object.keys(gravado)) delete gravado[k];
});

describe("quem recebe o boas-vindas", () => {
  it("sem campanha aprovada, usa o modelo embutido — funciona no primeiro dia", async () => {
    const r = await enviarBoasVindas("Pessoa@Empresa.com.BR", "Ana Ribeiro");
    expect(r.enviado).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toEqual(["pessoa@empresa.com.br"]);   // normalizado
  });

  it("resolve o primeiro nome no assunto — {{nome}} literal é o erro clássico", async () => {
    await enviarBoasVindas("a@b.com.br", "Ana Ribeiro");
    expect(enviados[0].subject).toContain("Ana");
    expect(enviados[0].subject).not.toContain("{{");
  });

  it("sem nome, o assunto cai no texto padrão em vez de ficar truncado", async () => {
    await enviarBoasVindas("a@b.com.br", null);
    expect(enviados[0].subject).not.toContain("{{");
    expect(enviados[0].subject.trim()).not.toBe("");
  });

  /**
   * Endereço suprimido é bounce duro ou reclamação de spam. Mandar mesmo assim é o caminho mais
   * rápido para o domínio inteiro cair na pasta de lixo — inclusive os e-mails transacionais.
   */
  it("endereço suprimido NÃO recebe, nem sendo uma inscrição nova", async () => {
    suprimido = { email: "a@b.com.br" };
    const r = await enviarBoasVindas("a@b.com.br", "Ana");
    expect(r.enviado).toBe(false);
    expect(r.motivo).toMatch(/suprimido/i);
    expect(enviados).toHaveLength(0);
  });

  it("sem RESEND_API_KEY não quebra — só não envia", async () => {
    const antes = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const r = await enviarBoasVindas("a@b.com.br", "Ana");
    expect(r.enviado).toBe(false);
    expect(enviados).toHaveLength(0);
    process.env.RESEND_API_KEY = antes;
  });
});

describe("quando existe campanha aprovada no estúdio", () => {
  const campanha = {
    id: "camp-1", assunto: "Bem-vindo, {{nome|tudo bem}}!", preheader: "oi",
    blocos: [{ tipo: "texto", texto: "Texto editado por quem opera." }],
    remetente: "Salestrack AI <aios@salestrack.com.br>",
  };

  it("é o texto DELA que sai, não o do modelo embutido", async () => {
    campanhaAprovada = campanha;
    await enviarBoasVindas("a@b.com.br", "Ana");
    expect(enviados[0].subject).toBe("Bem-vindo, Ana!");
  });

  /**
   * O registro em email_envios tem chave única (campanha, e-mail). É ele — e não uma variável em
   * memória — que garante um boas-vindas por pessoa mesmo se a confirmação for clicada duas vezes.
   */
  it("registra o envio na campanha, para virar métrica e idempotência", async () => {
    campanhaAprovada = campanha;
    await enviarBoasVindas("a@b.com.br", "Ana");
    expect(gravado["email_envios"]).toHaveLength(1);
    expect((gravado["email_envios"][0] as { campanha_id: string }).campanha_id).toBe("camp-1");
  });

  it("segunda confirmação do mesmo e-mail NÃO manda de novo", async () => {
    campanhaAprovada = campanha;
    insertFalha = true;   // conflito da chave única
    const r = await enviarBoasVindas("a@b.com.br", "Ana");
    expect(r.enviado).toBe(false);
    expect(enviados).toHaveLength(0);
  });
});

describe("obrigações que acompanham todo e-mail de marketing", () => {
  it("traz via de saída no corpo e o cabeçalho de um clique", async () => {
    await enviarBoasVindas("a@b.com.br", "Ana");
    const m = enviados[0] as unknown as { html: string; text: string; headers?: Record<string, string> };
    expect(m.html).toContain("https://x/descadastro/tok");
    expect(m.text).toContain("https://x/descadastro/tok");
    expect(m.headers?.["List-Unsubscribe"]).toBe("<https://x/api/descadastro/tok>");
    expect(m.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("vai em HTML e texto puro — só-HTML pontua pior em filtro de spam", async () => {
    await enviarBoasVindas("a@b.com.br", "Ana");
    const m = enviados[0] as unknown as { html: string; text: string };
    expect(m.html).toContain("<table");
    expect(m.text.length).toBeGreaterThan(40);
    /**
     * Procura TAGS CONHECIDAS, e não "qualquer coisa entre < e >".
     *
     * Duas asserções minhas já falharam aqui contra código correto: `not.toContain("<")` esbarra no
     * remetente `Salestrack AI <aios@…>`, e um genérico `/<\/?[a-z][^>]*>/` casa com esse mesmo
     * endereço, porque em ângulos ele parece uma tag. A lista fechada é o que distingue marcação de
     * e-mail escrito entre colchetes angulares.
     */
    expect(m.text).not.toMatch(/<\/?(table|tr|td|div|span|p|a|h[1-6]|ul|li|img|body|html)\b/i);
  });
});

afterAll(() => { globalThis.fetch = fetchOriginal; });
