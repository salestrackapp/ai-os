/**
 * AI OS · Suíte de Testes de RLS — "A Fortaleza", Domínio 2
 * Prova o isolamento entre tenants. NENHUM deploy passa sem esta suíte verde.
 *
 * Requer .env.local com: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Rodar: npm run test:rls
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canEnroll, SCORE_MIN } from "../lib/prospecting/score";
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TENANT_TABLES = [
  "tenant_branding","client_ai_stack","orchestrations","ai_policies",
  "sessions","session_credits","proposals","contracts","projects",
  "deliverables","subscriptions","invoices","activities","library_assets","invites","recipe_progress",
  "conversations","messages","roi_reports","ai_stack_entries","governance_policies",
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
  await admin.from("contracts").insert({ org_id: orgB, proposal_id: propB!.id, status: "minuta" });
  await admin.from("invoices").insert({ org_id: orgB, amount: 1000, status: "aberta", kind: "implantacao" });
  await admin.from("subscriptions").insert({ org_id: orgB, plan: "professional", monthly_amount: 4500, status: "ativa" });
  const { data: projB } = await admin.from("projects").insert({ org_id: orgB, name: "SEGREDO-B-proj" }).select("id").single();
  await admin.from("deliverables").insert({ project_id: projB!.id, org_id: orgB, title: "SEGREDO-B" });
  await admin.from("library_assets").insert({ org_id: orgB, type: "documento", title: "SEGREDO-B" });
  await admin.from("invites").insert({ org_id: orgB, email: "spy@b.com", role: "client_member" });
  await admin.from("activities").insert({ org_id: orgB, kind: "sistema", payload: { secret: "B" } });
  await admin.from("client_ai_stack").insert({
    org_id: orgB,
    platform_id: (await admin.from("ai_platforms").select("id").eq("name", "Claude").single()).data!.id,
  });
  await admin.from("session_credits").insert({ org_id: orgB, type: "sessao_estrategica", total: 3, consumed: 0 });
  // Fase 5: conversa/mensagem/ROI da Org B (o que A NÃO pode ver)
  const { data: convB } = await admin.from("conversations").insert({ org_id: orgB, canal: "portal" }).select("id").single();
  await admin.from("messages").insert({ conversation_id: convB!.id, org_id: orgB, role: "user", content: "SEGREDO-B" });
  await admin.from("roi_reports").insert({ org_id: orgB, periodo: "2026-01-01", metricas: {}, narrativa: "SEGREDO-B", publicado: true });
  // Org A: ROI publicado (A vê) + ROI rascunho (A NÃO vê nem o próprio)
  await admin.from("roi_reports").insert([
    { org_id: orgA, periodo: "2026-03-01", metricas: {}, narrativa: "publicado-A", publicado: true },
    { org_id: orgA, periodo: "2026-02-01", metricas: {}, narrativa: "rascunho-A", publicado: false },
  ]);
  // Fase 5.5: prospect interno da Salestrack (nenhuma org-cliente pode enxergar)
  const { data: pacc } = await admin.from("prospect_accounts").insert({ name: "RLS Prospect Co", domain: `rls-prospect-${Date.now()}.com` }).select("id").single();
  await admin.from("prospects").insert({ account_id: pacc!.id, name: "RLS Prospect", icp: "icp1", score: 90, email: `rls-prospect-${Date.now()}@x.com` });
  // Fase 6: stack de IA + governança da Org B (o que A NÃO pode ver)
  await admin.from("ai_stack_entries").insert({ org_id: orgB, platform_name: "SEGREDO-B", data_classification: "restrito" });
  await admin.from("governance_policies").insert({ org_id: orgB, security_summary_md: "SEGREDO-B", published: false });
  // Fase 7: camada operacional (admin-only) — o que A/anon NÃO podem ver
  await admin.from("alerts").insert({ kind: "custo_ia", severity: "info", org_id: orgB, message: "SEGREDO-B" });
  await admin.from("tenant_health").insert({ org_id: orgB, date: "2026-01-01", engagement_score: 10 });
  await admin.from("ai_cost_daily").insert({ org_id: orgB, date: "2026-01-01", agent_key: "consultor_programa", model: "x", cost_usd: 1 });
  await admin.from("model_prices").insert({ model: "rls-test-model", price_in_per_mtok: 1, price_out_per_mtok: 1 });
  // Fase 8: onboarding — checklist da Org B (isolado) + provisioning (admin-only)
  await admin.from("onboarding_checklists").insert({ org_id: orgB, items: [{ key: "x", label: "SEGREDO-B", done: false }] });
  await admin.from("tenant_provisioning").insert({ org_id: orgB, status: "pronto", steps: [] });
  // Progresso do Playbook da Org B (Fase 4b) — o que A NÃO pode ver
  const { data: anyRecipe } = await admin.from("playbook_recipes").select("id").eq("published", true).limit(1).single();
  if (anyRecipe) await admin.from("recipe_progress").insert({ org_id: orgB, user_id: uidB, recipe_id: anyRecipe.id, status: "concluida" });

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
  for (const t of ["ai_stack_entries","governance_policies","messages","conversations","roi_reports","recipe_progress","invites","library_assets","deliverables","contracts","invoices","subscriptions","activities","proposals","projects","sessions","session_credits","client_ai_stack","memberships"]) {
    await admin.from(t).delete().in("org_id", [orgA, orgB]);
  }
  await admin.from("organizations").delete().in("id", [orgA, orgB]);
  await admin.from("prospects").delete().eq("name", "RLS Prospect");
  await admin.from("prospect_accounts").delete().eq("name", "RLS Prospect Co");
  for (const t of ["alerts", "tenant_health", "ai_cost_daily", "onboarding_checklists", "tenant_provisioning"]) await admin.from(t).delete().in("org_id", [orgA, orgB]);
  await admin.from("model_prices").delete().eq("model", "rls-test-model");
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

describe("Playbook & Sessões · Fase 4b", () => {
  it("cliente lê receitas, trilhas e catálogo publicados", async () => {
    expect(((await userA.from("playbook_recipes").select("id").eq("published", true)).data ?? []).length).toBeGreaterThan(0);
    expect(((await userA.from("playbook_trilhas").select("id").eq("published", true)).data ?? []).length).toBeGreaterThan(0);
  });
  it("cliente NÃO escreve em playbook_recipes (admin-only)", async () => {
    const { error } = await userA.from("playbook_recipes").insert({ slug: `hack-${Date.now()}`, titulo: "hack", perfil: "operacional" });
    expect(error).not.toBeNull();
  });
  it("cliente A NÃO lê recipe_progress da org B", async () => {
    const { data } = await userA.from("recipe_progress").select("*").eq("org_id", orgB);
    expect(data ?? []).toHaveLength(0);
  });
  it("cliente A NÃO lê session_credits da org B", async () => {
    const { data } = await userA.from("session_credits").select("*").eq("org_id", orgB);
    expect(data ?? []).toHaveLength(0);
  });
  it("anônimo NÃO escreve progresso de receita", async () => {
    const { error } = await anon.from("recipe_progress").insert({ org_id: orgB, user_id: uidB, recipe_id: orgB, status: "concluida" });
    expect(error).not.toBeNull();
  });
});

describe("Consultor & Agentes · Fase 5", () => {
  it("cliente A NÃO lê conversations/messages/roi da org B", async () => {
    expect((await userA.from("conversations").select("*").eq("org_id", orgB)).data ?? []).toHaveLength(0);
    expect((await userA.from("messages").select("*").eq("org_id", orgB)).data ?? []).toHaveLength(0);
    expect((await userA.from("roi_reports").select("*").eq("org_id", orgB)).data ?? []).toHaveLength(0);
  });
  it("cliente A vê o ROI PUBLICADO da própria org, mas NÃO o rascunho", async () => {
    const { data } = await userA.from("roi_reports").select("narrativa, publicado").eq("org_id", orgA);
    const narrativas = (data ?? []).map((r) => r.narrativa);
    expect(narrativas).toContain("publicado-A");
    expect(narrativas).not.toContain("rascunho-A");
    expect((data ?? []).every((r) => r.publicado)).toBe(true);
  });
  it("cliente NÃO lê agent_prompts (admin-only) e não escreve", async () => {
    expect((await userA.from("agent_prompts").select("*")).data ?? []).toHaveLength(0);
    const { error } = await userA.from("agent_prompts").insert({ agent_key: "hack", system_prompt: "x" });
    expect(error).not.toBeNull();
  });
  it("cliente NÃO escreve mensagem/conversa em outra org", async () => {
    expect((await userA.from("conversations").insert({ org_id: orgB, canal: "portal" })).error).not.toBeNull();
  });
  it("anônimo NÃO lê conversations/messages/roi_reports/agent_prompts", async () => {
    expect((await anon.from("conversations").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("messages").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("roi_reports").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("agent_prompts").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("Prospecção · isolamento interno (Fase 5.5)", () => {
  const TABELAS = ["prospect_accounts", "prospects", "cadences", "cadence_enrollments", "cadence_step_log", "outreach_messages", "timeline_events"];
  it("cliente NÃO lê nenhuma tabela de prospecção (100% interna Salestrack)", async () => {
    for (const t of TABELAS) expect((await userA.from(t).select("*")).data ?? [], `vazou ${t}`).toHaveLength(0);
  });
  it("anônimo NÃO lê nenhuma tabela de prospecção", async () => {
    for (const t of TABELAS) expect((await anon.from(t).select("*")).data ?? [], `anon vazou ${t}`).toHaveLength(0);
  });
  it("cliente NÃO escreve prospects", async () => {
    const { error } = await userA.from("prospects").insert({ name: "hack" });
    expect(error).not.toBeNull();
  });
});

describe("Monetização · Fase 6", () => {
  it("cliente A NÃO lê stack/governança da org B", async () => {
    expect((await userA.from("ai_stack_entries").select("*").eq("org_id", orgB)).data ?? []).toHaveLength(0);
    expect((await userA.from("governance_policies").select("*").eq("org_id", orgB)).data ?? []).toHaveLength(0);
  });
  it("cliente lê o catálogo de planos (leitura autenticada)", async () => {
    expect(((await userA.from("plans").select("key")).data ?? []).length).toBeGreaterThan(0);
  });
  it("cliente NÃO escreve planos (admin-only)", async () => {
    const { error } = await userA.from("plans").insert({ key: `hack-${Date.now()}`, name: "hack" });
    expect(error).not.toBeNull();
  });
  it("anônimo NÃO lê planos, stack nem governança", async () => {
    expect((await anon.from("plans").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("ai_stack_entries").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("governance_policies").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("Observabilidade · Fase 7 (admin-only)", () => {
  const TAB = ["model_prices", "usage_events", "ai_cost_daily", "tenant_health", "alerts"];
  it("cliente NÃO lê nenhuma tabela operacional", async () => {
    for (const t of TAB) expect((await userA.from(t).select("*")).data ?? [], `vazou ${t}`).toHaveLength(0);
  });
  it("anônimo NÃO lê nenhuma tabela operacional", async () => {
    for (const t of TAB) expect((await anon.from(t).select("*")).data ?? [], `anon ${t}`).toHaveLength(0);
  });
  it("cliente NÃO escreve model_prices nem alerts", async () => {
    expect((await userA.from("model_prices").insert({ model: "hack", price_in_per_mtok: 1, price_out_per_mtok: 1 })).error).not.toBeNull();
    expect((await userA.from("alerts").insert({ kind: "hack", message: "x" })).error).not.toBeNull();
  });
});

describe("Biblioteca de Templates · Fase 9 (admin-only)", () => {
  const TAB = ["template_verticals", "template_blocks", "template_versions"];
  it("cliente NÃO lê verticais/blocos/versões", async () => {
    for (const t of TAB) expect((await userA.from(t).select("*")).data ?? [], t).toHaveLength(0);
  });
  it("anônimo NÃO lê verticais/blocos/versões", async () => {
    for (const t of TAB) expect((await anon.from(t).select("*")).data ?? [], t).toHaveLength(0);
  });
  it("cliente NÃO escreve template_blocks", async () => {
    const { error } = await userA.from("template_blocks").insert({ key: `hack-${Date.now()}`, name: "hack", category: "frente" });
    expect(error).not.toBeNull();
  });
});

describe("Onboarding · Fase 8", () => {
  it("cliente NÃO lê program_templates nem tenant_provisioning (admin-only)", async () => {
    expect((await userA.from("program_templates").select("*")).data ?? []).toHaveLength(0);
    expect((await userA.from("tenant_provisioning").select("*")).data ?? []).toHaveLength(0);
  });
  it("cliente A NÃO lê o checklist da org B", async () => {
    expect((await userA.from("onboarding_checklists").select("*").eq("org_id", orgB)).data ?? []).toHaveLength(0);
  });
  it("cliente NÃO escreve program_templates", async () => {
    const { error } = await userA.from("program_templates").insert({ key: `hack-${Date.now()}`, name: "hack" });
    expect(error).not.toBeNull();
  });
  it("anônimo NÃO lê templates/provisioning/checklists", async () => {
    expect((await anon.from("program_templates").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("tenant_provisioning").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("onboarding_checklists").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("Prospecção · gate de score (regra de ouro)", () => {
  it("score abaixo do mínimo do ICP NÃO entra em cadência", () => {
    expect(canEnroll({ score: SCORE_MIN.icp1 - 1, icp: "icp1" }).ok).toBe(false);
  });
  it("score no mínimo do ICP entra em cadência", () => {
    expect(canEnroll({ score: SCORE_MIN.icp1, icp: "icp1" }).ok).toBe(true);
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

describe("Portal do cliente · Fase 4a", () => {
  it("client_member (sponsor) NÃO cria convites (só client_admin)", async () => {
    const { error } = await userA.from("invites").insert({ org_id: orgA, email: "hack@a.com", role: "client_member" });
    expect(error).not.toBeNull();
  });
  it("anônimo NÃO lê invites nem library_assets", async () => {
    expect((await anon.from("invites").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("library_assets").select("*")).data ?? []).toHaveLength(0);
  });
  it("cliente NÃO lê tabelas administrativas (deals, catalog_items)", async () => {
    expect((await userA.from("deals").select("*")).data ?? []).toHaveLength(0);
    expect((await userA.from("catalog_items").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("Estúdio de Entregáveis · Fase B", () => {
  let idAprovadoA: string, idRascunhoA: string;
  beforeAll(async () => {
    const { data: a1 } = await admin.from("studio_deliverables").insert({ org_id: orgA, template_key: "one_pager", kind: "one_pager", title: "APROVADO-A", status: "aprovado" }).select("id").single();
    const { data: a2 } = await admin.from("studio_deliverables").insert({ org_id: orgA, template_key: "one_pager", kind: "one_pager", title: "RASCUNHO-A", status: "rascunho" }).select("id").single();
    await admin.from("studio_deliverables").insert({ org_id: orgB, template_key: "one_pager", kind: "one_pager", title: "APROVADO-B", status: "aprovado" });
    idAprovadoA = a1!.id; idRascunhoA = a2!.id;
  });
  afterAll(async () => { await admin.from("studio_deliverables").delete().in("id", [idAprovadoA, idRascunhoA]); });

  it("cliente A lê SEU entregável aprovado, mas NÃO o rascunho", async () => {
    const { data } = await userA.from("studio_deliverables").select("id, title, status");
    const titles = (data ?? []).map((d) => d.title);
    expect(titles).toContain("APROVADO-A");
    expect(titles).not.toContain("RASCUNHO-A");
  });
  it("cliente A NÃO lê entregável de outra org (mesmo aprovado)", async () => {
    const { data } = await userA.from("studio_deliverables").select("title");
    expect((data ?? []).map((d) => d.title)).not.toContain("APROVADO-B");
  });
  it("anônimo NÃO lê studio_deliverables", async () => {
    expect((await anon.from("studio_deliverables").select("*")).data ?? []).toHaveLength(0);
  });
  it("cliente NÃO grava studio_deliverables", async () => {
    const { error } = await userA.from("studio_deliverables").insert({ org_id: orgA, template_key: "one_pager", kind: "one_pager", title: "HACK", status: "aprovado" });
    expect(error).toBeTruthy();
  });
  it("cliente NÃO lê deliverable_templates nem versions (admin-only)", async () => {
    expect((await userA.from("deliverable_templates").select("*")).data ?? []).toHaveLength(0);
    expect((await userA.from("studio_deliverable_versions").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("CRUD kit · R2.1 (recurso sinais, admin-only + soft delete)", () => {
  it("cliente (não-admin) NÃO lê signal_definitions", async () => {
    expect((await userA.from("signal_definitions").select("*")).data ?? []).toHaveLength(0);
  });
  it("cliente NÃO grava signal_definitions", async () => {
    const { error } = await userA.from("signal_definitions").insert({ label: "hack", weight: 5 });
    expect(error).toBeTruthy();
  });
  it("anônimo NÃO lê signal_definitions", async () => {
    expect((await anon.from("signal_definitions").select("*")).data ?? []).toHaveLength(0);
  });
  it("coluna deleted_at existe (soft delete disponível)", async () => {
    const { error } = await admin.from("signal_definitions").select("id, deleted_at").limit(1);
    expect(error).toBeNull();
  });
});

describe("Navegação guiada · R1.4 (progresso por usuário)", () => {
  beforeAll(async () => {
    await admin.from("onboarding_progress").insert([
      { org_id: orgA, user_id: uidA, surface: "admin", key: "conhecer-hoje", done_at: new Date().toISOString() },
      { org_id: orgB, user_id: uidB, surface: "admin", key: "conhecer-hoje", done_at: new Date().toISOString() },
    ]);
  });
  afterAll(async () => { await admin.from("onboarding_progress").delete().in("user_id", [uidA, uidB]); });

  it("usuário A lê só o PRÓPRIO progresso (não o de B)", async () => {
    const { data } = await userA.from("onboarding_progress").select("user_id");
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((r) => r.user_id === uidA)).toBe(true);
  });
  it("usuário A NÃO grava progresso em nome de outro usuário", async () => {
    const { error } = await userA.from("onboarding_progress").insert({ org_id: orgA, user_id: uidB, surface: "admin", key: "hack", done_at: new Date().toISOString() });
    expect(error).toBeTruthy();
  });
  it("anônimo NÃO lê onboarding_progress", async () => {
    expect((await anon.from("onboarding_progress").select("*")).data ?? []).toHaveLength(0);
  });
});

describe("Configurações da aplicação", () => {
  it("cliente NÃO lê app_settings (admin-only)", async () => {
    const { data } = await userA.from("app_settings").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("anônimo NÃO lê app_settings", async () => {
    const { data } = await anon.from("app_settings").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("cliente NÃO grava app_settings", async () => {
    const { error } = await userA.from("app_settings").insert({ key: `hack_${Date.now()}`, value: { x: 1 } });
    expect(error).toBeTruthy();
  });
});

describe("Segredos de integração · Fase A (admin-only, nunca ao cliente)", () => {
  it("cliente NÃO lê integration_secrets", async () => {
    const { data } = await userA.from("integration_secrets").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("anônimo NÃO lê integration_secrets", async () => {
    const { data } = await anon.from("integration_secrets").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("cliente NÃO grava integration_secrets", async () => {
    const { error } = await userA.from("integration_secrets").insert({ provider: "anthropic", scope: "global", secret: "sk-hack" });
    expect(error).toBeTruthy();
  });
});

describe("Contratos & Billing · isolamento por tenant", () => {
  for (const table of ["contracts", "invoices", "subscriptions"]) {
    it(`cliente A NÃO lê ${table} da org B`, async () => {
      const { data } = await userA.from(table).select("*").eq("org_id", orgB);
      expect(data ?? [], `vazamento em ${table}`).toHaveLength(0);
    });
    it(`anônimo NÃO lê ${table}`, async () => {
      const { data } = await anon.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    });
  }
});
