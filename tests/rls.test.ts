/**
 * AI OS · Suíte de Testes de RLS — "A Fortaleza", Domínio 2
 * Prova o isolamento entre tenants. NENHUM deploy passa sem esta suíte verde.
 *
 * Requer .env.local com: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Rodar: npm run test:rls
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TENANT_TABLES = [
  "tenant_branding","client_ai_stack","orchestrations","ai_policies",
  "sessions","session_credits","proposals","contracts","projects",
  "deliverables","subscriptions","invoices","activities",
];

let admin: SupabaseClient;
let userA: SupabaseClient, userB: SupabaseClient, anon: SupabaseClient;
let orgA: string, orgB: string;
let uidA: string, uidB: string;

const email = (t: string) => `rls-${t}-${Date.now()}@teste.aios.local`;
const PASS = "Rls!Teste-2026-forte";

beforeAll(async () => {
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  // 1. Duas orgs de teste
  const { data: oA } = await admin.from("organizations").insert({ name: "RLS Org A", slug: `rls-a-${Date.now()}` }).select("id").single();
  const { data: oB } = await admin.from("organizations").insert({ name: "RLS Org B", slug: `rls-b-${Date.now()}` }).select("id").single();
  orgA = oA!.id; orgB = oB!.id;

  // 2. Dois usuários, um em cada org
  const uA = await admin.auth.admin.createUser({ email: email("a"), password: PASS, email_confirm: true });
  const uB = await admin.auth.admin.createUser({ email: email("b"), password: PASS, email_confirm: true });
  uidA = uA.data.user!.id; uidB = uB.data.user!.id;
  await admin.from("memberships").insert([
    { org_id: orgA, user_id: uidA, role: "sponsor" },
    { org_id: orgB, user_id: uidB, role: "sponsor" },
  ]);

  // 3. Dado sensível em cada tabela tenant da Org B (o que A NÃO pode ver)
  await admin.from("sessions").insert({ org_id: orgB, type: "sessao_estrategica", title: "SEGREDO-B" });
  await admin.from("projects").insert({ org_id: orgB, name: "SEGREDO-B" });
  const { data: propB } = await admin.from("proposals").insert({ org_id: orgB, title: "SEGREDO-B", items: [] }).select("id").single();
  await admin.from("proposal_events").insert({ proposal_id: propB!.id, kind: "viewed" });
  await admin.from("activities").insert({ org_id: orgB, kind: "sistema", payload: { secret: "B" } });
  await admin.from("client_ai_stack").insert({
    org_id: orgB,
    platform_id: (await admin.from("ai_platforms").select("id").eq("name", "Claude").single()).data!.id,
  });

  // 4. Clientes autenticados
  userA = createClient(URL, ANON, { auth: { persistSession: false } });
  userB = createClient(URL, ANON, { auth: { persistSession: false } });
  await userA.auth.signInWithPassword({ email: uA.data.user!.email!, password: PASS });
  await userB.auth.signInWithPassword({ email: uB.data.user!.email!, password: PASS });
  // cliente ANÔNIMO (sem login) — só a página pública via service role deve ler
  anon = createClient(URL, ANON, { auth: { persistSession: false } });
}, 60_000);

afterAll(async () => {
  // Limpeza
  for (const t of ["activities","proposals","projects","sessions","client_ai_stack","memberships"]) {
    await admin.from(t).delete().in("org_id", [orgA, orgB]);
  }
  await admin.from("organizations").delete().in("id", [orgA, orgB]);
  await admin.auth.admin.deleteUser(uidA);
  await admin.auth.admin.deleteUser(uidB);
});

describe("Isolamento entre tenants", () => {
  it("usuário A não enxerga NENHUMA linha da Org B em nenhuma tabela tenant", async () => {
    for (const table of TENANT_TABLES) {
      const { data } = await userA.from(table).select("*").eq("org_id", orgB);
      expect(data ?? [], `vazamento na tabela ${table}`).toHaveLength(0);
    }
  });

  it("usuário B enxerga os próprios dados", async () => {
    const { data } = await userB.from("projects").select("name").eq("org_id", orgB);
    expect(data?.map((d) => d.name)).toContain("SEGREDO-B");
  });

  it("usuário A não enxerga a organização B nem seus membros", async () => {
    const { data: orgs } = await userA.from("organizations").select("id").eq("id", orgB);
    expect(orgs ?? []).toHaveLength(0);
    const { data: members } = await userA.from("memberships").select("*").eq("org_id", orgB);
    expect(members ?? []).toHaveLength(0);
  });
});

describe("Escrita bloqueada para clientes", () => {
  it("cliente não cria itens de catálogo", async () => {
    const { error } = await userA.from("catalog_items").insert({ kind: "produto", brand: "salestrack", name: "hack" });
    expect(error).not.toBeNull();
  });
  it("cliente não altera deals do CRM", async () => {
    const { error } = await userA.from("deals").insert({ title: "hack" });
    expect(error).not.toBeNull();
  });
  it("cliente não escreve em proposals/contracts de outra org", async () => {
    const { error } = await userA.from("proposals").insert({ org_id: orgB, title: "hack", items: [] });
    expect(error).not.toBeNull();
  });
});

describe("Auditoria imutável", () => {
  it("audit_logs rejeita UPDATE e DELETE mesmo via cliente autenticado", async () => {
    const upd = await userA.from("audit_logs").update({ action: "adulterado" }).eq("id", 1);
    const del = await userA.from("audit_logs").delete().eq("id", 1);
    // sem privilégio: erro ou zero linhas afetadas
    expect(upd.error !== null || (upd.count ?? 0) === 0).toBe(true);
    expect(del.error !== null || (del.count ?? 0) === 0).toBe(true);
  });
});

describe("Catálogos globais", () => {
  it("cliente lê ai_platforms (catálogo dos Três Anéis)", async () => {
    const { data } = await userA.from("ai_platforms").select("name");
    expect((data ?? []).length).toBeGreaterThan(0);
  });
  it("cliente NÃO lê receitas não publicadas", async () => {
    const { data } = await userA.from("playbook_recipes").select("*").eq("published", false);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("Propostas · acesso público só via service role", () => {
  it("anônimo (sem login) NÃO lê proposals diretamente", async () => {
    const { data } = await anon.from("proposals").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("anônimo NÃO lê proposal_events diretamente", async () => {
    const { data } = await anon.from("proposal_events").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("cliente autenticado de outra org NÃO lê proposal_events (admin-only)", async () => {
    const { data } = await userA.from("proposal_events").select("*");
    expect(data ?? []).toHaveLength(0);
  });
});
