import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A inscrição é a única porta de entrada da lista de marketing — e é pública. Estas são as três
 * regras que, se afrouxarem, transformam a ferramenta de e-mail num problema jurídico.
 */

let linhas: Record<string, unknown[]> = {};
let inscricaoExistente: Record<string, unknown> | null = null;
const enviados: { to: string; subject: string }[] = [];
let cabecalhos: Record<string, string> = {};

const tabela = (nome: string) => ({
  select: () => ({
    ilike: () => ({ maybeSingle: async () => ({ data: inscricaoExistente }) }),
    eq: () => ({ maybeSingle: async () => ({ data: inscricaoExistente }) }),
  }),
  insert: (v: unknown) => {
    (linhas[nome] ??= []).push(v);
    const p = Promise.resolve({ data: { token: "token-novo" }, error: null }) as Promise<{ data: { token: string }; error: null }> & {
      select?: () => { single: () => Promise<{ data: { token: string }; error: null }> };
    };
    p.select = () => ({ single: async () => ({ data: { token: "token-novo" }, error: null }) });
    return p;
  },
  update: (v: unknown) => ({
    eq: () => {
      (linhas[`${nome}:update`] ??= []).push(v);
      const p = Promise.resolve({ data: { token: "token-renovado" }, error: null }) as Promise<unknown> & {
        select?: () => { maybeSingle: () => Promise<{ data: { token: string } }> };
      };
      p.select = () => ({ maybeSingle: async () => ({ data: { token: "token-renovado" } }) });
      return p;
    },
  }),
  upsert: (v: unknown) => { (linhas[`${nome}:upsert`] ??= []).push(v); return Promise.resolve({ error: null }); },
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => cabecalhos[k] ?? null }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: tabela }) }));
vi.mock("@/lib/audit", () => ({ auditService: async () => {} }));
vi.mock("@/lib/email", () => ({
  sendEmail: async (o: { to: string; subject: string }) => { enviados.push(o); return { ok: true }; },
}));

const { inscrever, confirmarInscricao } = await import("@/lib/marketing/inscricao");

beforeEach(() => {
  linhas = {}; inscricaoExistente = null; enviados.length = 0;
  cabecalhos = { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}` };
});

describe("enviar o formulário", () => {
  it("guarda a intenção e manda o e-mail de confirmação", async () => {
    const r = await inscrever({ email: "Pessoa@Empresa.com.BR", nome: "Ana", aceite: true });
    expect(r.ok).toBe(true);
    expect(linhas["newsletter_inscricoes"]).toHaveLength(1);
    expect((linhas["newsletter_inscricoes"][0] as { email: string }).email).toBe("pessoa@empresa.com.br");
    expect(enviados[0].to).toBe("pessoa@empresa.com.br");
  });

  /**
   * A regra central: enviar o formulário NÃO cria consentimento. Só o clique cria. Se esta
   * asserção quebrar, a lista passa a poder receber endereços que ninguém confirmou.
   */
  it("NÃO grava consentimento de marketing ainda — isso é do clique", async () => {
    await inscrever({ email: "pessoa@empresa.com.br", aceite: true });
    expect(linhas["consent_records"]).toBeUndefined();
    expect(linhas["comms_consent:upsert"]).toBeUndefined();
  });

  it("sem marcar a autorização, não inscreve", async () => {
    const r = await inscrever({ email: "pessoa@empresa.com.br", aceite: false });
    expect(r.ok).toBe(false);
    expect(linhas["newsletter_inscricoes"]).toBeUndefined();
    expect(enviados).toHaveLength(0);
  });

  it.each(["semarroba", "a@b", "@empresa.com", ""])("recusa e-mail malformado: %s", async (email) => {
    expect((await inscrever({ email, aceite: true })).ok).toBe(false);
  });

  it("guarda o texto que a pessoa leu — consentimento que não se demonstra é o mesmo que não ter", async () => {
    await inscrever({ email: "pessoa@empresa.com.br", aceite: true });
    const l = linhas["newsletter_inscricoes"][0] as { texto_aceite: string };
    expect(l.texto_aceite).toMatch(/sair a qualquer momento/i);
  });

  /**
   * Responder "esse e-mail já está na lista" transformaria o formulário público num verificador de
   * quem assina a newsletter, para qualquer um que quisesse testar endereços.
   */
  it("quem já confirmou recebe a MESMA resposta de quem acabou de se inscrever", async () => {
    const nova = await inscrever({ email: "a@empresa.com.br", aceite: true });
    inscricaoExistente = { id: "i1", confirmado_em: "2026-07-01T10:00:00Z" };
    const repetida = await inscrever({ email: "b@empresa.com.br", aceite: true });
    expect(repetida.ok).toBe(true);
    expect(repetida.mensagem).toBe(nova.mensagem);
    expect(enviados).toHaveLength(1);   // e nenhum e-mail novo sai para quem já está dentro
  });

  it("limite de taxa: o mesmo IP não dispara em série", async () => {
    cabecalhos = { "x-forwarded-for": "203.0.113.9" };
    const rs = [];
    for (let i = 0; i < 8; i++) rs.push(await inscrever({ email: `p${i}@empresa.com.br`, aceite: true }));
    expect(rs.filter((r) => r.ok).length).toBeLessThanOrEqual(5);
    expect(rs.at(-1)!.mensagem).toMatch(/tentativas/i);
  });
});

describe("o clique de confirmação", () => {
  const base = { id: "i1", email: "Pessoa@Empresa.com.BR", nome: "Ana", texto_aceite: "…", ip: "1.1.1.1", user_agent: "ua", cancelado_em: null };

  it("cria o consentimento de marketing e libera o canal", async () => {
    inscricaoExistente = { ...base, confirmado_em: null, expira_em: new Date(Date.now() + 86400000).toISOString() };
    const r = await confirmarInscricao("t");
    expect(r.estado).toBe("confirmado");

    const c = linhas["consent_records"][0] as { email: string; finalidade: string; estado: string; base_legal: string };
    expect(c.email).toBe("pessoa@empresa.com.br");   // normalizado, senão o portão não casa depois
    expect(c.finalidade).toBe("marketing");
    expect(c.estado).toBe("concedido");
    expect(c.base_legal).toBe("consentimento");
    expect(linhas["comms_consent:upsert"]).toHaveLength(1);
  });

  it("link vencido não vira consentimento", async () => {
    inscricaoExistente = { ...base, confirmado_em: null, expira_em: new Date(Date.now() - 86400000).toISOString() };
    expect((await confirmarInscricao("t")).estado).toBe("expirado");
    expect(linhas["consent_records"]).toBeUndefined();
  });

  it("token desconhecido não vira consentimento", async () => {
    inscricaoExistente = null;
    expect((await confirmarInscricao("t")).estado).toBe("invalido");
    expect(linhas["consent_records"]).toBeUndefined();
  });

  it("clicar duas vezes não duplica o consentimento", async () => {
    inscricaoExistente = { ...base, confirmado_em: "2026-07-01T10:00:00Z", expira_em: new Date(Date.now() + 86400000).toISOString() };
    expect((await confirmarInscricao("t")).estado).toBe("ja_confirmado");
    expect(linhas["consent_records"]).toBeUndefined();
  });

  it("inscrição cancelada não pode ser reconfirmada por um link antigo", async () => {
    inscricaoExistente = { ...base, cancelado_em: "2026-07-20T10:00:00Z", confirmado_em: null, expira_em: new Date(Date.now() + 86400000).toISOString() };
    expect((await confirmarInscricao("t")).estado).toBe("invalido");
    expect(linhas["consent_records"]).toBeUndefined();
  });
});
