import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O convite não pode trocar a senha de ninguém.
 *
 * ── O defeito ─────────────────────────────────────────────────────────────────────────────────
 * Quando o e-mail convidado já tinha conta, `acceptInvite` chamava `updateUserById({ password })`.
 * Aceitar um convite REDEFINIA a senha de uma conta existente para a que estivesse digitada.
 *
 * O caminho de ataque era curto: qualquer `client_admin` de qualquer organização cliente pode criar
 * convite para qualquer e-mail. Bastava convidar um admin da Salestrack, abrir o próprio link e
 * escolher a senha dele. Como o fluxo nunca foi usado em produção (zero convites), ninguém tropeçou.
 *
 * O teste espiona a API de admin do Supabase: o que se prova é que `updateUserById` NÃO é chamada.
 */

const chamadas: string[] = [];
let existeConta = false;

const authAdmin = {
  createUser: vi.fn(async () => {
    chamadas.push("createUser");
    return existeConta
      ? { data: null, error: { message: "A user with this email address has already been registered" } }
      : { data: { user: { id: "novo-user" } }, error: null };
  }),
  listUsers: vi.fn(async () => {
    chamadas.push("listUsers");
    return { data: { users: [{ id: "user-existente", email: "alvo@empresa.com.br" }] }, error: null };
  }),
  updateUserById: vi.fn(async () => {
    chamadas.push("updateUserById");   // se aparecer, a senha alheia foi tocada
    return { data: null, error: null };
  }),
};

const tabela = (nome: string) => ({
  select: () => ({
    eq: () => ({
      single: async () => ({
        data: nome === "invites"
          ? { id: "inv-1", org_id: "org-1", email: "alvo@empresa.com.br", role: "client_member", token: "t", accepted_at: null, expires_at: new Date(Date.now() + 86400000).toISOString() }
          : null,
      }),
    }),
  }),
  upsert: async () => { chamadas.push(`upsert:${nome}`); return { error: null }; },
  update: () => ({ eq: async () => { chamadas.push(`update:${nome}`); return { error: null }; } }),
  insert: (() => {
    // `insert` é usada de dois jeitos no código: aguardada direto (audit_logs) e encadeada com
    // `.select().single()` (invites, que precisa do token gerado). O duble serve os dois.
    const p = (async () => { chamadas.push(`insert:${nome}`); return { error: null }; })() as Promise<{ error: null }> & {
      select?: () => { single: () => Promise<{ data: { token: string }; error: null }> };
    };
    p.select = () => ({ single: async () => ({ data: { token: "token-gerado" }, error: null }) });
    return () => p;
  })(),
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: tabela, auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: tabela, auth: { admin: authAdmin } }) }));
vi.mock("@/lib/auth", () => ({ currentMembership: async () => ({ userId: "u", orgId: "org-1", role: "client_admin", isSalestrackAdmin: false }) }));
vi.mock("@/lib/audit", () => ({ audit: async () => {} }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => ({ sent: true }) }));

const { acceptInvite, createClientInvite } = await import("@/app/portal/equipe/actions");

beforeEach(() => { chamadas.length = 0; });

describe("aceite de convite", () => {
  it("conta NOVA: cria o usuário com a senha escolhida e vincula à organização", async () => {
    existeConta = false;
    const r = await acceptInvite("t", "senha-bem-comprida");
    expect(r.jaTinhaConta).toBe(false);
    expect(chamadas).toContain("createUser");
    expect(chamadas).toContain("upsert:memberships");
    expect(chamadas).not.toContain("updateUserById");
  });

  it("conta QUE JÁ EXISTE: vincula à organização e NÃO toca na senha", async () => {
    existeConta = true;
    const r = await acceptInvite("t", "senha-do-atacante");
    expect(r.jaTinhaConta).toBe(true);
    expect(chamadas).toContain("upsert:memberships");
    // A asserção que importa: a credencial da vítima permanece intocada.
    expect(chamadas, "o convite redefiniu a senha de uma conta existente").not.toContain("updateUserById");
    expect(authAdmin.updateUserById).not.toHaveBeenCalled();
  });

  it("o convite é consumido nos dois casos — não fica valendo para uma segunda tentativa", async () => {
    existeConta = true;
    await acceptInvite("t", "outra-senha-qualquer");
    expect(chamadas).toContain("update:invites");
  });
});

describe("quem pode ser convidado", () => {
  it("cliente NÃO convida endereço da Salestrack — porta de engenharia social", async () => {
    const fd = new FormData();
    fd.set("email", "andre.kachan@salestrack.com.br");
    fd.set("role", "client_admin");
    await expect(createClientInvite("org-1", fd)).rejects.toThrow(/Salestrack/);
  });

  it("endereço de cliente comum passa", async () => {
    const fd = new FormData();
    fd.set("email", "pessoa@empresa.com.br");
    fd.set("role", "client_member");
    await expect(createClientInvite("org-1", fd)).resolves.toBeUndefined();
  });
});
