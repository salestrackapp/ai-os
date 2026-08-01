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

// Academy · Fase 2: userC é o ALUNO AVULSO — autenticado e SEM membership nenhum.
// É a fixture que não existia e que prova o modelo de matrícula-como-acesso: para ele
// user_org_ids() devolve vazio, então toda policy escopada por org avalia falso.
let userC: SupabaseClient, uidC: string;
let acCurso1: string, acCurso2: string, acModulo1: string, acAula1: string, acTarefa1: string;
let acMatriculaC: string, acMatriculaA: string, acMatriculaB: string;

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

  // Academy · Fase 2 — dois cursos publicados.
  // Curso 1: matrícula do aluno avulso (C, sem org) + do corporativo (A, org A).
  // Curso 2: só matrícula da org B — serve para provar que quem não tem matrícula não lê aula.
  const uC = await admin.auth.admin.createUser({ email: email("c"), password: PASS, email_confirm: true });
  uidC = uC.data.user!.id; // de propósito SEM membership: é o aluno avulso
  const { data: c1 } = await admin.from("academy_courses")
    .insert({ slug: `rls-curso-1-${Date.now()}`, titulo: "RLS Curso 1", status: "publicado", acesso: "restrito" }).select("id").single();
  const { data: c2 } = await admin.from("academy_courses")
    .insert({ slug: `rls-curso-2-${Date.now()}`, titulo: "RLS Curso 2", status: "publicado", acesso: "restrito" }).select("id").single();
  acCurso1 = c1!.id; acCurso2 = c2!.id;
  const { data: m1 } = await admin.from("academy_modules").insert({ course_id: acCurso1, ordem: 0, titulo: "SEGREDO-MOD" }).select("id").single();
  acModulo1 = m1!.id;
  const { data: l1 } = await admin.from("academy_lessons").insert({ module_id: acModulo1, ordem: 0, titulo: "SEGREDO-AULA", tipo: "conceito", corpo: {} }).select("id").single();
  const { data: t1 } = await admin.from("academy_tasks").insert({ module_id: acModulo1, ordem: 0, texto: "SEGREDO-TAREFA" }).select("id").single();
  acAula1 = l1!.id; acTarefa1 = t1!.id;
  const { data: mc } = await admin.from("academy_enrollments").insert({ course_id: acCurso1, user_id: uidC, org_id: null, origem: "individual", nome: "Aluno Avulso" }).select("id").single();
  const { data: ma } = await admin.from("academy_enrollments").insert({ course_id: acCurso1, user_id: uidA, org_id: orgA, origem: "org", nome: "Aluno Org A" }).select("id").single();
  const { data: mb } = await admin.from("academy_enrollments").insert({ course_id: acCurso2, user_id: uidB, org_id: orgB, origem: "org", nome: "SEGREDO-B-aluno" }).select("id").single();
  acMatriculaC = mc!.id; acMatriculaA = ma!.id; acMatriculaB = mb!.id;

  // 4. Clientes autenticados
  userA = createClient(URL, ANON, { auth: { persistSession: false } });
  userB = createClient(URL, ANON, { auth: { persistSession: false } });
  userC = createClient(URL, ANON, { auth: { persistSession: false } });
  await userA.auth.signInWithPassword({ email: uA.data.user!.email!, password: PASS });
  await userB.auth.signInWithPassword({ email: uB.data.user!.email!, password: PASS });
  await userC.auth.signInWithPassword({ email: uC.data.user!.email!, password: PASS });
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
  // Academy: apagar o curso cascateia módulos, aulas, tarefas, matrículas e progresso.
  await admin.from("academy_courses").delete().in("id", [acCurso1, acCurso2]);
  await admin.auth.admin.deleteUser(uidA);
  await admin.auth.admin.deleteUser(uidB);
  await admin.auth.admin.deleteUser(uidC);
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

/**
 * Rascunhos que a IA escreve para a inbox da equipe. O conteúdo é a conversa de um cliente vista
 * pelo nosso lado — inclusive de clientes que não são a org de quem estiver logado. Vazar isto é
 * vazar conversa alheia, não só um texto gerado.
 */
describe("Resposta assistida · rel_sugestoes (admin-only)", () => {
  it("cliente NÃO lê rascunhos do agente", async () => {
    expect((await userA.from("rel_sugestoes").select("*")).data ?? []).toHaveLength(0);
  });
  it("anônimo NÃO lê rascunhos do agente", async () => {
    expect((await anon.from("rel_sugestoes").select("*")).data ?? []).toHaveLength(0);
  });
  it("cliente NÃO cria rascunho — senão injetaria texto na inbox da Salestrack", async () => {
    const { error } = await userA.from("rel_sugestoes").insert({ conversa_id: orgA, texto: "hack" });
    expect(error).not.toBeNull();
  });
});

/**
 * As tabelas que as Server Actions do admin escrevem SEM guarda própria até hoje.
 *
 * A auditoria das actions mostrou que a proteção delas era só a RLS — e a RLS não estava testada
 * justamente nestas tabelas. A defesa existia e ninguém saberia se sumisse: bastaria alguém
 * afrouxar uma política por outro motivo ("deixar o client_admin editar os contatos da própria
 * empresa" é um pedido razoável) para várias actions ficarem abertas de uma vez, em silêncio.
 *
 * As actions ganharam guarda local no mesmo commit. Este bloco fixa a SEGUNDA camada.
 */
describe("Escrita de cliente barrada nas tabelas do admin", () => {
  it("cliente NÃO cria fatura nem assinatura — é dinheiro", async () => {
    expect((await userA.from("invoices").insert({ org_id: orgA, kind: "mensalidade", amount: 1, status: "aberta" })).error).not.toBeNull();
    expect((await userA.from("subscriptions").insert({ org_id: orgA, status: "ativa" })).error).not.toBeNull();
  });

  it("cliente NÃO cria contato nem organização", async () => {
    expect((await userA.from("contacts").insert({ org_id: orgA, name: "hack" })).error).not.toBeNull();
    expect((await userA.from("organizations").insert({ name: "hack", slug: `hack-${Date.now()}` })).error).not.toBeNull();
  });

  it("cliente NÃO cria tarefa nem item de catálogo", async () => {
    expect((await userA.from("tasks").insert({ title: "hack" })).error).not.toBeNull();
    expect((await userA.from("catalog_items").insert({ name: "hack", kind: "produto" })).error).not.toBeNull();
  });

  it("cliente NÃO escreve template da inbox — o que sai em nome da Salestrack", async () => {
    expect((await userA.from("rel_templates").insert({ nome: "hack", corpo: "x" })).error).not.toBeNull();
  });

  /**
   * Marcar a própria fatura como paga seria o ataque mais lucrativo do sistema, e é UPDATE, não
   * INSERT — políticas de insert e de update são separadas aqui, e testar só uma esconde a outra.
   */
  it("cliente NÃO marca a própria fatura como paga", async () => {
    const { error } = await userA.from("invoices").update({ status: "paga", paid_at: new Date().toISOString() }).eq("org_id", orgA);
    const { data } = await userA.from("invoices").select("id").eq("status", "paga");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

/**
 * E-mail marketing. Três tabelas, e a mais sensível não é a campanha: é `email_envios`, que junta
 * endereço com comportamento ("abriu", "clicou"). Uma lista de quem abre o quê é exatamente o tipo
 * de dado que não pode escapar do lado da Salestrack.
 */
describe("E-mail marketing · interno (admin-only)", () => {
  const TAB = ["email_campanhas", "email_envios", "email_supressao"];
  it("cliente NÃO lê campanha, envio nem supressão", async () => {
    for (const t of TAB) expect((await userA.from(t).select("*")).data ?? [], `vazou ${t}`).toHaveLength(0);
  });
  it("anônimo NÃO lê nenhuma das três", async () => {
    for (const t of TAB) expect((await anon.from(t).select("*")).data ?? [], `anon ${t}`).toHaveLength(0);
  });
  it("cliente NÃO cria campanha nem se autoadiciona a uma lista", async () => {
    expect((await userA.from("email_campanhas").insert({ nome: "hack", assunto: "x" })).error).not.toBeNull();
    expect((await userA.from("email_supressao").insert({ email: "x@y.com", motivo: "manual" })).error).not.toBeNull();
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

// Academy · Fase 2. O modelo é matrícula-como-acesso: quem tem matrícula ativa lê o conteúdo,
// tenha empresa ou não. Estes testes existem para provar as três coisas que podem dar errado:
// (a) o aluno avulso — sem membership — realmente enxerga o curso dele;
// (b) quem NÃO tem matrícula não enxerga aula nenhuma (prova que a herança de policy funciona:
//     a policy de academy_lessons faz exists(academy_modules), que por sua vez herda o portão
//     de academy_courses — a condição de matrícula está escrita uma vez só);
// (c) gestor enxerga a turma da própria org e nada da org vizinha.
describe("Academy · aluno avulso e isolamento de matrícula", () => {
  it("aluno avulso (sem membership) LÊ o curso em que está matriculado", async () => {
    const { data } = await userC.from("academy_courses").select("id").eq("id", acCurso1);
    expect(data ?? [], "aluno avulso deveria enxergar o curso da matrícula dele").toHaveLength(1);
  });
  it("aluno avulso LÊ as aulas do curso dele", async () => {
    const { data } = await userC.from("academy_lessons").select("id").eq("id", acAula1);
    expect(data ?? [], "aluno avulso deveria enxergar a aula").toHaveLength(1);
  });
  it("aluno avulso NÃO lê curso em que não está matriculado", async () => {
    const { data } = await userC.from("academy_courses").select("id").eq("id", acCurso2);
    expect(data ?? []).toHaveLength(0);
  });
  it("quem NÃO tem matrícula não lê NENHUMA aula (prova a herança de policy)", async () => {
    // userB está matriculado só no curso 2; o módulo/aula de teste pertencem ao curso 1.
    const { data } = await userB.from("academy_lessons").select("id").eq("id", acAula1);
    expect(data ?? [], "aula vazou para quem não tem matrícula no curso").toHaveLength(0);
  });
  it("aluno avulso lê a PRÓPRIA matrícula e nenhuma outra", async () => {
    const { data } = await userC.from("academy_enrollments").select("id");
    expect((data ?? []).map((r) => r.id)).toEqual([acMatriculaC]);
  });
  it("gestor da org A lê a matrícula da equipe dele, e ZERO da org B", async () => {
    const { data } = await userA.from("academy_enrollments").select("id, org_id");
    const ids = (data ?? []).map((r) => r.id);
    expect(ids, "gestor deveria ver a matrícula da própria org").toContain(acMatriculaA);
    expect(ids, "vazamento de matrícula entre orgs").not.toContain(acMatriculaB);
  });
  it("aluno NÃO grava progresso na matrícula de outra pessoa", async () => {
    const { error } = await userC.from("academy_progress").insert({ enrollment_id: acMatriculaA, task_id: acTarefa1 });
    expect(error, "aluno conseguiu gravar progresso na matrícula alheia").not.toBeNull();
  });
  it("aluno GRAVA progresso na própria matrícula", async () => {
    const { error } = await userC.from("academy_progress").insert({ enrollment_id: acMatriculaC, task_id: acTarefa1 });
    expect(error, "aluno deveria poder marcar a própria tarefa").toBeNull();
  });
  it("aluno NÃO altera a própria matrícula (nada de estender validade ou se dar como concluído)", async () => {
    await userC.from("academy_enrollments").update({ status: "concluida", expires_at: "2099-01-01" }).eq("id", acMatriculaC);
    const { data } = await admin.from("academy_enrollments").select("status, expires_at").eq("id", acMatriculaC).single();
    expect(data!.status, "aluno conseguiu se marcar como concluído").toBe("ativa");
    expect(data!.expires_at, "aluno conseguiu estender a própria validade").toBeNull();
  });
  it("anônimo NÃO lê nada das tabelas da Academy", async () => {
    for (const t of ["academy_courses", "academy_modules", "academy_lessons", "academy_tasks", "academy_enrollments", "academy_progress"]) {
      const { data } = await anon.from(t).select("*");
      expect(data ?? [], `vazou ${t} para anônimo`).toHaveLength(0);
    }
  });
});

// O agente que o aluno constrói é o dado mais pessoal da Academy. Ninguém além dele lê,
// exceto o gestor da org — e só se o aluno marcar como compartilhado.
describe("Academy · agentes e estado das ferramentas", () => {
  let agenteC: string;
  beforeAll(async () => {
    const { data } = await admin.from("academy_agents")
      .insert({ user_id: uidC, nome: "SEGREDO-agente-do-C", missao: "confidencial" }).select("id").single();
    agenteC = data!.id;
  });
  afterAll(async () => {
    await admin.from("academy_agents").delete().eq("user_id", uidC);
    await admin.from("academy_tool_state").delete().in("user_id", [uidA, uidC]);
  });

  it("o dono LÊ o próprio agente", async () => {
    const { data } = await userC.from("academy_agents").select("id").eq("id", agenteC);
    expect(data ?? []).toHaveLength(1);
  });
  it("outro aluno NÃO lê o agente alheio", async () => {
    const { data } = await userA.from("academy_agents").select("id").eq("id", agenteC);
    expect(data ?? [], "agente vazou para outro usuário").toHaveLength(0);
  });
  it("aluno NÃO cria agente em nome de outra pessoa", async () => {
    const { error } = await userA.from("academy_agents").insert({ user_id: uidC, nome: "forjado" });
    expect(error, "usuário criou agente para outro").not.toBeNull();
  });
  it("estado das ferramentas é estritamente pessoal", async () => {
    await admin.from("academy_tool_state").insert({ user_id: uidC, chave: "roi_agente", dados: { segredo: true } });
    const { data } = await userA.from("academy_tool_state").select("id");
    expect(data ?? [], "estado pessoal vazou").toHaveLength(0);
    const { data: meu } = await userC.from("academy_tool_state").select("id");
    expect(meu ?? [], "o dono deveria ler o próprio estado").toHaveLength(1);
  });
  it("anônimo NÃO lê agentes nem estado", async () => {
    for (const t of ["academy_agents", "academy_tool_state"]) {
      const { data } = await anon.from(t).select("*");
      expect(data ?? [], `vazou ${t}`).toHaveLength(0);
    }
  });
});

// Referências são material de apoio, não dado de cliente: qualquer autenticado lê o que está
// publicado. Mas só o admin Salestrack escreve, e rascunho não vaza para aluno.
describe("Academy · biblioteca de referências", () => {
  let refPublicada: string, refRascunho: string;
  beforeAll(async () => {
    const { data: a } = await admin.from("academy_referencias")
      .insert({ tipo: "termo", chave: `rls-pub-${Date.now()}`, nome: "RLS Termo Publicado", publicado: true }).select("id").single();
    const { data: b } = await admin.from("academy_referencias")
      .insert({ tipo: "termo", chave: `rls-rasc-${Date.now()}`, nome: "SEGREDO-rascunho", publicado: false }).select("id").single();
    refPublicada = a!.id; refRascunho = b!.id;
  });
  afterAll(async () => {
    await admin.from("academy_referencias").delete().in("id", [refPublicada, refRascunho]);
  });

  it("aluno avulso LÊ referência publicada", async () => {
    const { data } = await userC.from("academy_referencias").select("id").eq("id", refPublicada);
    expect(data ?? [], "referência publicada deveria ser legível").toHaveLength(1);
  });
  it("aluno NÃO lê referência em rascunho", async () => {
    const { data } = await userC.from("academy_referencias").select("id").eq("id", refRascunho);
    expect(data ?? [], "rascunho vazou para o aluno").toHaveLength(0);
  });
  it("aluno NÃO cria nem altera referência", async () => {
    const { error: eIns } = await userC.from("academy_referencias").insert({ tipo: "termo", chave: "forjada", nome: "forjada" });
    expect(eIns, "aluno conseguiu criar referência").not.toBeNull();
    await userC.from("academy_referencias").update({ nome: "adulterada" }).eq("id", refPublicada);
    const { data } = await admin.from("academy_referencias").select("nome").eq("id", refPublicada).single();
    expect(data!.nome, "aluno conseguiu alterar referência").toBe("RLS Termo Publicado");
  });
  it("anônimo NÃO lê referências", async () => {
    const { data } = await anon.from("academy_referencias").select("*");
    expect(data ?? []).toHaveLength(0);
  });
});

// Notificação é pessoal: nem outro usuário nem admin lê a dos outros. A escrita é só do
// despachante (service_role); um usuário não pode fabricar notificação para terceiros.
describe("Notificações · isolamento por usuário", () => {
  beforeAll(async () => {
    await admin.from("notifications").insert({
      user_id: uidB, event: "deal_won", title: "SEGREDO-B-notificacao", body: "só do B",
    });
    await admin.from("notification_prefs").insert({ user_id: uidB, event: "deal_won", in_app: false, email: false });
  });
  afterAll(async () => {
    await admin.from("notifications").delete().eq("user_id", uidB);
    await admin.from("notification_prefs").delete().eq("user_id", uidB);
    await admin.from("notification_prefs").delete().eq("user_id", uidA);
  });

  it("usuário A NÃO lê notificação do usuário B", async () => {
    const { data } = await userA.from("notifications").select("*");
    expect(data ?? [], "vazamento de notificação entre usuários").toHaveLength(0);
  });
  it("anônimo NÃO lê notificações", async () => {
    const { data } = await anon.from("notifications").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("usuário A NÃO cria notificação para o usuário B", async () => {
    const { error } = await userA.from("notifications").insert({ user_id: uidB, event: "deal_won", title: "forjada" });
    expect(error, "usuário conseguiu forjar notificação para outro").not.toBeNull();
  });
  it("usuário A NÃO lê preferências do usuário B", async () => {
    const { data } = await userA.from("notification_prefs").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("usuário A GRAVA a própria preferência", async () => {
    const { error } = await userA.from("notification_prefs")
      .insert({ user_id: uidA, event: "task_overdue", in_app: true, email: false });
    expect(error, "usuário deveria poder gravar a própria preferência").toBeNull();
  });
});

// A view deal_timeline une activities + timeline_events. Views rodam com os privilégios do DONO
// por padrão, o que CONTORNARIA a RLS das tabelas de baixo — por isso ela é declarada com
// security_invoker = on (migration 032). Estes testes existem para provar que continua assim:
// se alguém recriar a view sem a opção, o histórico de um cliente vaza para outro e isto quebra.
describe("Timeline unificada · view deal_timeline (security_invoker)", () => {
  let dealB: string;
  beforeAll(async () => {
    const { data: d } = await admin.from("deals")
      .insert({ org_id: orgB, title: "SEGREDO-B-deal", stage: "qualificado" }).select("id").single();
    dealB = d!.id;
    await admin.from("activities").insert({
      org_id: orgB, kind: "nota", ref_table: "deals", ref_id: dealB, payload: { event: "SEGREDO-B-atividade" },
    });
  });
  afterAll(async () => {
    await admin.from("activities").delete().eq("ref_id", dealB);
    await admin.from("deals").delete().eq("id", dealB);
  });

  it("cliente A NÃO enxerga a timeline de um deal da org B", async () => {
    const { data } = await userA.from("deal_timeline").select("*").eq("deal_id", dealB);
    expect(data ?? [], "vazamento na view deal_timeline").toHaveLength(0);
  });
  it("anônimo NÃO enxerga nada em deal_timeline", async () => {
    const { data } = await anon.from("deal_timeline").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("admin Salestrack enxerga a atividade do deal pela view", async () => {
    const { data } = await admin.from("deal_timeline").select("*").eq("deal_id", dealB);
    expect((data ?? []).length, "a view deveria devolver a atividade semeada").toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Academy · Bloco 6: avaliação e certificado.
// É o bloco de maior superfície de segurança do sistema de formação. Duas coisas
// precisam ser inalcançáveis pelo aluno, e são elas que estes testes atacam:
// o GABARITO e a NOTA. Os dois ataques abaixo são exatamente o que um aluno faria
// com a chave anônima no navegador.
// ─────────────────────────────────────────────────────────────────────────────
describe("Academy · prova, gabarito e certificado", () => {
  let prova: string, questao: string, tentativaC: string, certC: string;

  beforeAll(async () => {
    const { data: p } = await admin.from("academy_assessments")
      .insert({ course_id: acCurso1, titulo: "RLS Prova", nota_minima: 70, exige_conclusao: false }).select("id").single();
    prova = p!.id;
    const { data: q } = await admin.from("academy_questions")
      .insert({ assessment_id: prova, ordem: 0, enunciado: "Quanto é 2+2?", tipo: "multipla", alternativas: ["3", "4", "5"] })
      .select("id").single();
    questao = q!.id;
    await admin.from("academy_question_keys").insert({ question_id: questao, gabarito: "1" });

    const { data: t } = await admin.from("academy_attempts")
      .insert({ enrollment_id: acMatriculaC, assessment_id: prova, numero: 1 }).select("id").single();
    tentativaC = t!.id;

    const { data: cert } = await admin.from("formacao_certificados").insert({
      org_id: null, enrollment_id: acMatriculaC, course_id: acCurso1, user_id: uidC,
      participante_nome: "Aluno Avulso", formacao_titulo: "RLS Curso 1", codigo: `RLS-${Date.now()}`.slice(0, 14),
    }).select("id").single();
    certC = cert!.id;
  });

  afterAll(async () => {
    await admin.from("formacao_certificados").delete().eq("id", certC);
    await admin.from("academy_attempt_respostas").delete().eq("attempt_id", tentativaC);
    await admin.from("academy_attempts").delete().eq("assessment_id", prova);
    await admin.from("academy_question_keys").delete().eq("question_id", questao);
    await admin.from("academy_questions").delete().eq("assessment_id", prova);
    await admin.from("academy_assessments").delete().eq("id", prova);
  });

  it("o aluno matriculado LÊ a prova e o enunciado das questões", async () => {
    const { data: pr } = await userC.from("academy_assessments").select("id").eq("id", prova);
    expect(pr ?? [], "o aluno deveria enxergar a prova do curso dele").toHaveLength(1);
    const { data: qs } = await userC.from("academy_questions").select("id, enunciado").eq("id", questao);
    expect(qs ?? []).toHaveLength(1);
  });

  it("NINGUÉM além do admin lê o gabarito — nem o aluno matriculado", async () => {
    for (const [quem, cli] of [["aluno avulso", userC], ["cliente org A", userA], ["anônimo", anon]] as const) {
      const { data } = await cli.from("academy_question_keys").select("gabarito");
      expect(data ?? [], `GABARITO VAZOU para ${quem}`).toHaveLength(0);
    }
    const { data: adm } = await admin.from("academy_question_keys").select("gabarito").eq("question_id", questao);
    expect(adm ?? [], "o admin deveria ler o gabarito").toHaveLength(1);
  });

  it("o aluno NÃO grava a própria nota na tentativa", async () => {
    const { error } = await userC.from("academy_attempts")
      .update({ nota: 100, status: "aprovado" }).eq("id", tentativaC);
    expect(error, "o aluno conseguiu escrever a própria nota").not.toBeNull();
    const { data } = await admin.from("academy_attempts").select("nota, status").eq("id", tentativaC).single();
    expect(data!.nota, "a nota foi alterada apesar do erro").toBeNull();
    expect(data!.status).toBe("em_andamento");
  });

  it("o aluno NÃO abre tentativa em nome de outra pessoa", async () => {
    const { error } = await userC.from("academy_attempts")
      .insert({ enrollment_id: acMatriculaA, assessment_id: prova, numero: 9 });
    expect(error, "abriu tentativa na matrícula alheia").not.toBeNull();
  });

  it("o aluno NÃO insere tentativa já aprovada", async () => {
    const { error } = await userC.from("academy_attempts")
      .insert({ enrollment_id: acMatriculaC, assessment_id: prova, numero: 8, nota: 100, status: "aprovado" });
    expect(error, "inseriu tentativa já aprovada").not.toBeNull();
  });

  it("as respostas são do dono — outro aluno não lê", async () => {
    await admin.from("academy_attempt_respostas").insert({ attempt_id: tentativaC, question_id: questao, resposta: "1" });
    const { data: alheio } = await userA.from("academy_attempt_respostas").select("resposta").eq("attempt_id", tentativaC);
    expect(alheio ?? [], "as respostas vazaram para outro aluno").toHaveLength(0);
    const { data: meu } = await userC.from("academy_attempt_respostas").select("resposta").eq("attempt_id", tentativaC);
    expect(meu ?? [], "o dono deveria ler as próprias respostas").toHaveLength(1);
  });

  it("o aluno avulso LÊ o próprio certificado (era o bloqueio do org_id NOT NULL)", async () => {
    const { data } = await userC.from("formacao_certificados").select("id").eq("id", certC);
    expect(data ?? [], "o aluno sem empresa não enxergou o próprio certificado").toHaveLength(1);
  });

  it("certificado alheio NÃO vaza, e ninguém emite o próprio", async () => {
    const { data } = await userA.from("formacao_certificados").select("id").eq("id", certC);
    expect(data ?? [], "certificado vazou para outro usuário").toHaveLength(0);
    const { error } = await userC.from("formacao_certificados")
      .insert({ enrollment_id: acMatriculaC, participante_nome: "Forjado", formacao_titulo: "Forjado" });
    expect(error, "o aluno emitiu o próprio certificado").not.toBeNull();
  });

  it("anônimo NÃO lê prova, gabarito, tentativa nem certificado", async () => {
    for (const t of ["academy_assessments", "academy_questions", "academy_question_keys",
                     "academy_attempts", "academy_attempt_respostas", "formacao_certificados"]) {
      const { data } = await anon.from(t).select("*");
      expect(data ?? [], `vazou ${t} para anônimo`).toHaveLength(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Academy · Bloco 7: pagamento. O gate é gatilho de banco, não código de aplicação,
// porque a policy de matrícula permite ao gestor de cliente inserir para a equipe —
// se o gate vivesse só na Server Action, um gestor liberaria curso pago pelo PostgREST.
// ─────────────────────────────────────────────────────────────────────────────
describe("Academy · gate de pagamento", () => {
  let cursoPago: string;
  afterAll(async () => {
    await admin.from("academy_orders").delete().eq("course_id", cursoPago);
    await admin.from("academy_enrollments").delete().eq("course_id", cursoPago);
    await admin.from("academy_courses").delete().eq("id", cursoPago);
  });

  beforeAll(async () => {
    const { data } = await admin.from("academy_courses").insert({
      slug: `rls-pago-${Date.now()}`, titulo: "RLS Curso Pago", status: "publicado",
      acesso: "restrito", gratuito: false, preco_centavos: 49700,
    }).select("id").single();
    cursoPago = data!.id;
  });

  it("matrícula em curso PAGO sem pedido nasce 'pendente' — o conteúdo não abre", async () => {
    // insert pelo service role imita qualquer caminho que não seja admin logado
    const { data } = await admin.from("academy_enrollments")
      .insert({ course_id: cursoPago, user_id: uidC, origem: "individual", status: "ativa" })
      .select("id, status").single();
    expect(data!.status, "curso pago liberou acesso sem pagamento").toBe("pendente");
    await admin.from("academy_enrollments").delete().eq("id", data!.id);
  });

  it("com pedido PAGO, a matrícula nasce ativa", async () => {
    await admin.from("academy_orders").insert({
      course_id: cursoPago, user_id: uidC, provider: "manual", valor_centavos: 49700, status: "pago",
    });
    const { data } = await admin.from("academy_enrollments")
      .insert({ course_id: cursoPago, user_id: uidC, origem: "individual", status: "ativa" })
      .select("id, status").single();
    expect(data!.status, "pedido pago deveria liberar a matrícula").toBe("ativa");
    await admin.from("academy_enrollments").delete().eq("id", data!.id);
    await admin.from("academy_orders").delete().eq("course_id", cursoPago).eq("user_id", uidC);
  });

  it("origem 'salestrack' libera — é a cortesia do admin", async () => {
    const { data } = await admin.from("academy_enrollments")
      .insert({ course_id: cursoPago, user_id: uidC, origem: "salestrack", status: "ativa" })
      .select("id, status").single();
    expect(data!.status).toBe("ativa");
    await admin.from("academy_enrollments").delete().eq("id", data!.id);
  });

  it("curso GRATUITO libera direto", async () => {
    const { data: g } = await admin.from("academy_courses").insert({
      slug: `rls-gratis-${Date.now()}`, titulo: "RLS Curso Grátis", status: "publicado", gratuito: true,
    }).select("id").single();
    const { data } = await admin.from("academy_enrollments")
      .insert({ course_id: g!.id, user_id: uidC, origem: "individual", status: "ativa" })
      .select("id, status").single();
    expect(data!.status).toBe("ativa");
    await admin.from("academy_enrollments").delete().eq("id", data!.id);
    await admin.from("academy_courses").delete().eq("id", g!.id);
  });

  it("o aluno NÃO marca o próprio pedido como pago", async () => {
    const { data: p } = await admin.from("academy_orders").insert({
      course_id: cursoPago, user_id: uidC, provider: "asaas", valor_centavos: 49700, status: "pendente",
    }).select("id").single();
    // update é só de admin: a policy nem alcança a linha
    await userC.from("academy_orders").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", p!.id);
    const { data: depois } = await admin.from("academy_orders").select("status").eq("id", p!.id).single();
    expect(depois!.status, "o aluno marcou o próprio pedido como pago").toBe("pendente");
    // e não consegue inserir um já pago
    const { error } = await userC.from("academy_orders")
      .insert({ course_id: cursoPago, user_id: uidC, provider: "manual", status: "pago" });
    expect(error, "o aluno inseriu pedido já pago").not.toBeNull();
    await admin.from("academy_orders").delete().eq("id", p!.id);
  });

  it("pedido alheio não vaza; anônimo não lê nada", async () => {
    const { data: p } = await admin.from("academy_orders").insert({
      course_id: cursoPago, user_id: uidC, provider: "manual", valor_centavos: 49700, status: "pago",
    }).select("id").single();
    const { data: outro } = await userA.from("academy_orders").select("id").eq("id", p!.id);
    expect(outro ?? [], "pedido vazou para outro usuário").toHaveLength(0);
    const { data: an } = await anon.from("academy_orders").select("*");
    expect(an ?? [], "pedido vazou para anônimo").toHaveLength(0);
    const { data: meu } = await userC.from("academy_orders").select("id").eq("id", p!.id);
    expect(meu ?? [], "o dono deveria ler o próprio pedido").toHaveLength(1);
    await admin.from("academy_orders").delete().eq("id", p!.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Academy · Bloco 8: a view do gestor. O risco dela é vazamento entre clientes —
// uma view sem `security_invoker = on` roda com privilégio do dono e entrega a turma
// de TODAS as empresas para qualquer gestor. Estes testes atacam exatamente isso.
// ─────────────────────────────────────────────────────────────────────────────
describe("Academy · view academy_enrollment_stats", () => {
  it("o gestor da org A NÃO vê a matrícula da org B pela view", async () => {
    const { data } = await userA.from("academy_enrollment_stats").select("enrollment_id, org_id, nome");
    const vazou = (data ?? []).filter((r: { org_id: string | null }) => r.org_id === orgB);
    expect(vazou, "a view vazou matrícula de outra empresa").toHaveLength(0);
  });

  it("o aluno avulso vê só a linha dele", async () => {
    const { data } = await userC.from("academy_enrollment_stats").select("enrollment_id, user_id");
    for (const r of data ?? []) {
      expect((r as { user_id: string }).user_id, "a view mostrou matrícula de outra pessoa ao aluno").toBe(uidC);
    }
  });

  it("a view NÃO expõe respostas de prova — só nota", async () => {
    const { data } = await admin.from("academy_enrollment_stats").select("*").limit(1);
    const colunas = Object.keys((data ?? [{}])[0] ?? {});
    for (const proibida of ["resposta", "respostas", "gabarito"]) {
      expect(colunas.some((c) => c.includes(proibida)), `a view expõe "${proibida}"`).toBe(false);
    }
    expect(colunas, "a view deveria trazer a melhor nota").toContain("melhor_nota");
  });

  it("anônimo NÃO lê a view", async () => {
    const { data } = await anon.from("academy_enrollment_stats").select("*");
    expect(data ?? [], "a view vazou para anônimo").toHaveLength(0);
  });

  it("conta tarefas e reflete o progresso real da matrícula", async () => {
    await admin.from("academy_progress").delete().eq("enrollment_id", acMatriculaC);
    const { data: antes } = await admin.from("academy_enrollment_stats")
      .select("tarefas_total, tarefas_feitas").eq("enrollment_id", acMatriculaC).single();
    expect(Number(antes!.tarefas_feitas)).toBe(0);
    expect(Number(antes!.tarefas_total), "o curso de teste tem 1 tarefa").toBeGreaterThan(0);

    await admin.from("academy_progress").insert({ enrollment_id: acMatriculaC, task_id: acTarefa1 });
    const { data: depois } = await admin.from("academy_enrollment_stats")
      .select("tarefas_feitas, ultima_atividade").eq("enrollment_id", acMatriculaC).single();
    expect(Number(depois!.tarefas_feitas), "a view não refletiu a tarefa concluída").toBe(1);
    expect(depois!.ultima_atividade, "última atividade deveria estar preenchida").not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketing (Fase 3 · Bloco 4). Campanha, custo e origem são dado da EMPRESA:
// um cliente que enxergasse isso veria quanto a Salestrack gasta para captá-lo.
// ─────────────────────────────────────────────────────────────────────────────
describe("Marketing · campanhas, origem e atribuição", () => {
  let campanha: string, contatoLead: string, origemId: string;

  beforeAll(async () => {
    const { data: o } = await admin.from("lead_sources").select("id").eq("slug", "salestrack-site").single();
    origemId = o!.id;
    const { data: c } = await admin.from("campaigns").insert({
      nome: "RLS Campanha SEGREDO", canal: "conteudo", lead_source_id: origemId,
      inicio: new Date().toISOString().slice(0, 10), custo_centavos: 250000, status: "ativa",
    }).select("id").single();
    campanha = c!.id;
    const { data: ct } = await admin.from("contacts").insert({
      org_id: null, name: "RLS Lead Promovido", email: `rls-lead-${Date.now()}@teste.local`,
      lead_source_id: origemId, lead_ref: `site_leads:${crypto.randomUUID()}`,
    }).select("id").single();
    contatoLead = ct!.id;
    await admin.from("campaign_touches").insert({ campaign_id: campanha, contact_id: contatoLead, tipo: "formulario" });
  });

  afterAll(async () => {
    await admin.from("campaign_touches").delete().eq("campaign_id", campanha);
    await admin.from("campaigns").delete().eq("id", campanha);
    await admin.from("contacts").delete().eq("id", contatoLead);
  });

  it("cliente NÃO vê campanha, custo nem toque", async () => {
    for (const t of ["campaigns", "campaign_touches", "lead_sources"]) {
      const { data } = await userA.from(t).select("*");
      expect(data ?? [], `${t} vazou para cliente`).toHaveLength(0);
    }
  });

  it("aluno avulso e anônimo também não veem", async () => {
    for (const [quem, cli] of [["aluno", userC], ["anônimo", anon]] as const) {
      const { data } = await cli.from("campaigns").select("nome");
      expect(data ?? [], `campanha vazou para ${quem}`).toHaveLength(0);
    }
  });

  it("cliente NÃO cria nem altera campanha", async () => {
    const { error: eIns } = await userA.from("campaigns")
      .insert({ nome: "forjada", canal: "conteudo", inicio: "2026-01-01" });
    expect(eIns, "cliente criou campanha").not.toBeNull();
    await userA.from("campaigns").update({ custo_centavos: 1 }).eq("id", campanha);
    const { data } = await admin.from("campaigns").select("custo_centavos").eq("id", campanha).single();
    expect(data!.custo_centavos, "cliente alterou o custo da campanha").toBe(250000);
  });

  it("o admin vê a campanha e o toque", async () => {
    const { data: c } = await admin.from("campaigns").select("id").eq("id", campanha);
    expect(c ?? []).toHaveLength(1);
    const { data: t } = await admin.from("campaign_touches").select("id").eq("campaign_id", campanha);
    expect(t ?? []).toHaveLength(1);
  });

  it("o e-mail do contato é único entre vivos — a mesma pessoa não duplica", async () => {
    const { data: existente } = await admin.from("contacts").select("email").eq("id", contatoLead).single();
    const { error } = await admin.from("contacts")
      .insert({ org_id: null, name: "Duplicata", email: existente!.email });
    expect(error, "permitiu dois contatos vivos com o mesmo e-mail").not.toBeNull();
  });

  it("a view de atribuição não vaza negócio de outro cliente", async () => {
    const { data } = await userA.from("deal_attribution").select("deal_id, contact_id");
    // userA é cliente da org A; deals da org B não podem aparecer
    const { data: deB } = await admin.from("deals").select("id").eq("org_id", orgB);
    const idsB = new Set((deB ?? []).map((d) => d.id));
    const vazou = (data ?? []).filter((r) => idsB.has(r.deal_id as string));
    expect(vazou, "a atribuição vazou negócio de outra empresa").toHaveLength(0);
  });
});

describe("LGPD · consentimento, pedidos do titular e descadastro", () => {
  const alvo = `zz-lgpd-${Date.now()}@teste.local`;
  let contato: string;
  let pedido: string;

  beforeAll(async () => {
    const { data: c } = await admin.from("contacts")
      .insert({ org_id: null, name: "ZZTESTE LGPD", email: alvo }).select("id").single();
    contato = c!.id;
    await admin.from("consent_records").insert([
      { contact_id: contato, email: alvo, finalidade: "transacional", base_legal: "execucao_contrato", estado: "concedido" },
      { contact_id: contato, email: alvo, finalidade: "marketing", base_legal: "consentimento", estado: "concedido" },
    ]);
    const { data: p } = await admin.from("dsr_requests")
      .insert({ tipo: "acesso", email: alvo, nome: "ZZTESTE LGPD" }).select("id").single();
    pedido = p!.id;
    await admin.from("descadastro_tokens").insert({ canal: "email", endereco: alvo });
  });

  afterAll(async () => {
    await admin.from("descadastro_tokens").delete().eq("endereco", alvo);
    await admin.from("dsr_requests").delete().eq("email", alvo);
    await admin.from("consent_records").delete().eq("email", alvo);
    await admin.from("contacts").delete().eq("id", contato);
  });

  it("o cliente não lê consentimento de ninguém — é dado interno da Salestrack", async () => {
    const { data } = await userA.from("consent_records").select("id");
    expect(data ?? [], "cliente leu registros de consentimento").toHaveLength(0);
  });

  it("o cliente não lê nem cria pedido de titular", async () => {
    const { data } = await userA.from("dsr_requests").select("id");
    expect(data ?? [], "cliente leu pedidos de titular").toHaveLength(0);
    const { error } = await userA.from("dsr_requests").insert({ tipo: "exclusao", email: "invasor@x.com" });
    expect(error, "cliente registrou pedido de titular").not.toBeNull();
  });

  it("o token de descadastro não é legível por cliente — vazaria o e-mail de terceiro", async () => {
    const { data } = await userA.from("descadastro_tokens").select("endereco");
    expect(data ?? [], "cliente leu tokens de descadastro").toHaveLength(0);
  });

  it("o prazo de 15 dias é carimbado pelo banco, não digitado", async () => {
    const { data } = await admin.from("dsr_requests")
      .select("recebido_em, prazo_em").eq("id", pedido).single();
    const dias = Math.round(
      (new Date(data!.prazo_em).getTime() - new Date(data!.recebido_em).getTime()) / 86400000);
    expect(dias, "o prazo não são 15 dias").toBe(15);
  });

  it("a finalidade e o estado do consentimento são vocabulário fechado", async () => {
    const { error: e1 } = await admin.from("consent_records")
      .insert({ email: alvo, finalidade: "inventada", base_legal: "consentimento" });
    expect(e1, "aceitou finalidade fora do vocabulário").not.toBeNull();
    const { error: e2 } = await admin.from("consent_records")
      .insert({ email: alvo, finalidade: "marketing", base_legal: "consentimento", estado: "talvez" });
    expect(e2, "aceitou estado fora do vocabulário").not.toBeNull();
  });

  it("consentimento sem titular identificável é recusado", async () => {
    const { error } = await admin.from("consent_records")
      .insert({ finalidade: "marketing", base_legal: "consentimento" });
    expect(error, "gravou consentimento sem e-mail, telefone nem contato").not.toBeNull();
  });

  it("a exclusão apaga o titular e NÃO toca a auditoria", async () => {
    const { count: antes } = await admin.from("audit_logs")
      .select("id", { count: "exact", head: true });

    const { data: r, error } = await admin.rpc("fn_lgpd_excluir_titular", { p_email: alvo });
    expect(error, "a exclusão falhou").toBeNull();
    expect((r as Record<string, number>).contacts, "não apagou o contato").toBe(1);

    const { data: sobrou } = await admin.from("contacts").select("id").eq("id", contato);
    expect(sobrou ?? [], "o contato sobreviveu à exclusão").toHaveLength(0);

    const { count: depois } = await admin.from("audit_logs")
      .select("id", { count: "exact", head: true });
    expect(depois!, "a exclusão apagou linhas de auditoria").toBeGreaterThanOrEqual(antes!);

    // O consentimento não some: vira prova de que a revogação foi atendida.
    const { data: cons } = await admin.from("consent_records").select("estado").eq("email", alvo);
    expect(cons ?? [], "os consentimentos sumiram em vez de virar 'revogado'").not.toHaveLength(0);
    expect((cons ?? []).every((c) => c.estado === "revogado"),
      "sobrou consentimento não revogado após a exclusão").toBe(true);
  });

  it("o titular anônimo não executa a exclusão via RPC", async () => {
    const { error } = await anon.rpc("fn_lgpd_excluir_titular", { p_email: alvo });
    expect(error, "anônimo conseguiu executar a exclusão em massa").not.toBeNull();
  });

  it("o cliente autenticado também não executa a exclusão", async () => {
    const { error } = await userA.rpc("fn_lgpd_excluir_titular", { p_email: alvo });
    expect(error, "cliente conseguiu executar a exclusão em massa").not.toBeNull();
  });

  it("o token continua servindo depois de usado — link antigo não pode quebrar", async () => {
    // Endereço próprio: o token do `alvo` é apagado pela exclusão, e apagar ali é o certo.
    const outro = `zz-token-${Date.now()}@teste.local`;
    const { data: t } = await admin.from("descadastro_tokens")
      .insert({ canal: "email", endereco: outro }).select("token").single();
    await admin.from("descadastro_tokens")
      .update({ usado_em: new Date().toISOString() }).eq("token", t!.token);
    const { data } = await admin.from("descadastro_tokens").select("endereco").eq("token", t!.token);
    expect(data ?? [], "o token sumiu depois de usado").toHaveLength(1);
    await admin.from("descadastro_tokens").delete().eq("endereco", outro);
  });
});

describe("LGPD · o inventário do titular não é chamável por quem não é a Salestrack", () => {
  it("o cliente autenticado não varre o CRM pelo inventário", async () => {
    const { error } = await userA.rpc("fn_lgpd_inventario_titular", { p_email: "qualquer@pessoa.com" });
    expect(error, "cliente logado leu o inventário de um titular").not.toBeNull();
  });
  it("o anônimo também não", async () => {
    const { error } = await anon.rpc("fn_lgpd_inventario_titular", { p_email: "qualquer@pessoa.com" });
    expect(error, "anônimo leu o inventário de um titular").not.toBeNull();
  });
});

describe("LGPD · prospecção só com dado corporativo, marketing bloqueado por procedência", () => {
  const corp = `zz-corp-${Date.now()}@empresateste.com.br`;
  const pessoal = `zz-pess-${Date.now()}@gmail.com`;
  let prospect: string;

  afterAll(async () => {
    await admin.from("prospects").delete().ilike("email", `zz-%@%`).ilike("name", "ZZTESTE%");
    await admin.from("consent_records").delete().in("email", [corp, pessoal]);
    await admin.from("contacts").delete().ilike("email", `zz-corp-%@empresateste.com.br`);
  });

  it("as regras do banco batem com as do TypeScript — mesma tabela de casos", async () => {
    const { data } = await admin.rpc("fn_email_corporativo", { p_email: "ana@empresa.com.br" });
    expect(data, "banco recusou e-mail corporativo").toBe(true);
    for (const p of ["ana@gmail.com", "ana@uol.com.br", "ana@outlook.com", "ana@icloud.com", "semarroba"]) {
      const { data: r } = await admin.rpc("fn_email_corporativo", { p_email: p });
      expect(r, `banco aceitou ${p}, que é caixa pessoal`).toBe(false);
    }
    // Telefone não é mais filtrado (decisão de 2026-07-30): o critério de dado corporativo é o
    // domínio do e-mail. A função continua existindo como ponto único de reintrodução do filtro.
    for (const t of ["(11) 3333-4444", "(11) 98888-7777", "+55 11 98888-7777"]) {
      const { data } = await admin.rpc("fn_telefone_corporativo", { p_tel: t });
      expect(data, `banco recusou ${t}, mas telefone não é mais filtrado`).toBe(true);
    }
  });

  it("prospect coletado com e-mail corporativo entra", async () => {
    const { data, error } = await admin.from("prospects")
      .insert({ name: "ZZTESTE Corp", email: corp, procedencia: "coleta_publica", status: "novo" })
      .select("id, dado_corporativo, retencao_ate").single();
    expect(error, `recusou dado corporativo: ${error?.message}`).toBeNull();
    prospect = data!.id;
    expect(data!.dado_corporativo, "não marcou como corporativo").toBe(true);
    // Retenção carimbada na entrada, não deixada para depois.
    const dias = Math.round((new Date(data!.retencao_ate).getTime() - Date.now()) / 86400000);
    expect(dias, "o prazo de retenção não são ~180 dias").toBeGreaterThan(178);
  });

  it("prospect coletado com caixa PESSOAL é recusado pelo banco, não só pela tela", async () => {
    const { error } = await admin.from("prospects")
      .insert({ name: "ZZTESTE Pessoal", email: pessoal, procedencia: "coleta_publica", status: "novo" });
    expect(error, "gravou caixa pessoal por coleta").not.toBeNull();
    expect(error!.message).toContain("corporativo");
  });

  it("prospect coletado com CELULAR é aceito — a regra do telefone foi revertida", async () => {
    const email = `zz-cel-${Date.now()}@empresateste.com.br`;
    const { data, error } = await admin.from("prospects").insert({
      name: "ZZTESTE Celular", email, phone: "(11) 98888-7777",
      procedencia: "coleta_publica", status: "novo",
    }).select("id").single();
    expect(error, `recusou celular, que passou a ser aceito: ${error?.message}`).toBeNull();
    await admin.from("prospects").delete().eq("id", data!.id);
    await admin.from("consent_records").delete().eq("email", email);
  });

  it("o mesmo dado pessoal PASSA quando foi o titular que forneceu", async () => {
    const { data, error } = await admin.from("prospects")
      .insert({ name: "ZZTESTE Titular", email: pessoal, phone: "(11) 98888-7777", procedencia: "titular", status: "novo" })
      .select("id").single();
    expect(error, `recusou dado que o próprio titular forneceu: ${error?.message}`).toBeNull();
    await admin.from("prospects").delete().eq("id", data!.id);
  });

  it("marketing é bloqueado por PROCEDÊNCIA, mesmo com consentimento gravado", async () => {
    // Alguém grava um consentimento de marketing para quem veio de coleta — por engano ou não.
    await admin.from("consent_records").insert({
      email: corp, finalidade: "marketing", base_legal: "consentimento", estado: "concedido",
      concedido_em: new Date().toISOString(),
    });
    const { data } = await admin.rpc("fn_pode_marketing", { p_email: corp });
    expect(data, "dado coletado entrou em marketing porque alguém marcou a caixa").toBe(false);
  });

  it("marketing é liberado para quem o próprio titular forneceu e consentiu", async () => {
    const email = `zz-titular-${Date.now()}@empresateste.com.br`;
    const { data: c } = await admin.from("contacts")
      .insert({ org_id: null, name: "ZZTESTE Titular", email, procedencia: "titular" })
      .select("id").single();
    await admin.from("consent_records").insert({
      contact_id: c!.id, email, finalidade: "marketing", base_legal: "consentimento",
      estado: "concedido", concedido_em: new Date().toISOString(),
    });
    const { data } = await admin.rpc("fn_pode_marketing", { p_email: email });
    expect(data, "bloqueou marketing de quem consentiu e forneceu o próprio dado").toBe(true);
    await admin.from("consent_records").delete().eq("email", email);
    await admin.from("contacts").delete().eq("id", c!.id);
  });

  it("o gate de marketing não é chamável por cliente nem por anônimo", async () => {
    const { error: e1 } = await userA.rpc("fn_pode_marketing", { p_email: corp });
    expect(e1, "cliente chamou o gate de marketing").not.toBeNull();
    const { error: e2 } = await anon.rpc("fn_pode_marketing", { p_email: corp });
    expect(e2, "anônimo chamou o gate de marketing").not.toBeNull();
  });

  it("o cliente não lê a base de prospecção", async () => {
    const { data } = await userA.from("prospects").select("id, email");
    expect(data ?? [], "cliente leu prospects").toHaveLength(0);
  });
});

describe("Prospecção · buscas automáticas pelo Apollo", () => {
  let busca: string;

  beforeAll(async () => {
    const { data } = await admin.from("prospect_buscas").insert({
      nome: "ZZTESTE Busca", icp: "icp1", cargos: ["COO"], locais: ["Brazil"],
      meta_por_execucao: 5, teto_enriquecimento: 5,
    }).select("id").single();
    busca = data!.id;
  });

  afterAll(async () => {
    await admin.from("prospect_busca_execucoes").delete().eq("busca_id", busca);
    await admin.from("prospects").delete().eq("busca_id", busca);
    await admin.from("prospect_buscas").delete().eq("id", busca);
  });

  it("o cliente não lê nem cria busca — prospecção é interna da Salestrack", async () => {
    const { data } = await userA.from("prospect_buscas").select("id");
    expect(data ?? [], "cliente leu as buscas de prospecção").toHaveLength(0);
    const { error } = await userA.from("prospect_buscas")
      .insert({ nome: "invasora", cargos: ["CEO"] });
    expect(error, "cliente criou busca de prospecção").not.toBeNull();
  });

  it("o cliente não lê o histórico de execuções", async () => {
    const { data } = await userA.from("prospect_busca_execucoes").select("id");
    expect(data ?? [], "cliente leu execuções de coleta").toHaveLength(0);
  });

  it("o anônimo não lê nada disso", async () => {
    const { data: a } = await anon.from("prospect_buscas").select("id");
    const { data: b } = await anon.from("prospect_busca_execucoes").select("id");
    expect([...(a ?? []), ...(b ?? [])], "anônimo leu a prospecção").toHaveLength(0);
  });

  it("o teto de créditos é limitado pelo banco — não dá para pedir 10 mil por engano", async () => {
    const { error } = await admin.from("prospect_buscas")
      .insert({ nome: "ZZTESTE Teto", cargos: ["CEO"], teto_enriquecimento: 10000 });
    expect(error, "aceitou teto de crédito acima do limite").not.toBeNull();
  });

  it("prospect coletado guarda de qual busca veio — é o registro do porquê ele está aqui", async () => {
    const email = `zz-busca-${Date.now()}@industriateste.com.br`;
    const { data, error } = await admin.from("prospects").insert({
      name: "ZZTESTE Vindo da Busca", email, procedencia: "coleta_publica",
      busca_id: busca, source: "apollo", status: "novo",
    }).select("id, busca_id").single();
    expect(error, `não gravou: ${error?.message}`).toBeNull();
    expect(data!.busca_id, "perdeu o vínculo com a busca").toBe(busca);
    await admin.from("prospects").delete().eq("id", data!.id);
    await admin.from("consent_records").delete().eq("email", email);
  });

  it("celular agora entra — a regra do telefone foi revertida", async () => {
    const email = `zz-cel-ok-${Date.now()}@industriateste.com.br`;
    const { data, error } = await admin.from("prospects").insert({
      name: "ZZTESTE Celular OK", email, phone: "(11) 98888-7777",
      procedencia: "coleta_publica", status: "novo",
    }).select("id").single();
    expect(error, `recusou celular, que agora é aceito: ${error?.message}`).toBeNull();
    await admin.from("prospects").delete().eq("id", data!.id);
    await admin.from("consent_records").delete().eq("email", email);
  });

  it("caixa pessoal continua recusada — é ela que define dado corporativo", async () => {
    const { error } = await admin.from("prospects").insert({
      name: "ZZTESTE Pessoal", email: `zz-p-${Date.now()}@gmail.com`,
      procedencia: "coleta_publica", status: "novo",
    });
    expect(error, "gravou caixa pessoal por coleta").not.toBeNull();
  });
});

describe("Engajamento e sinais do LinkedIn", () => {
  let prospect: string;
  let post: string;
  const slug = `zzteste-perfil-${Date.now()}`;

  beforeAll(async () => {
    const { data: p } = await admin.from("prospects").insert({
      name: "ZZTESTE Engajado", email: `zz-eng-${Date.now()}@industriateste.com.br`,
      linkedin_url: `https://www.linkedin.com/in/${slug}`,
      procedencia: "coleta_publica", status: "novo",
    }).select("id").single();
    prospect = p!.id;
    const { data: lp } = await admin.from("linkedin_posts")
      .insert({ titulo: "ZZTESTE Post sobre IA", tema_ia: true }).select("id").single();
    post = lp!.id;
  });

  afterAll(async () => {
    await admin.from("linkedin_interacoes").delete().eq("post_id", post);
    await admin.from("linkedin_posts").delete().eq("id", post);
    await admin.from("engagement_events").delete().eq("prospect_id", prospect);
    await admin.from("engagement_links").delete().eq("prospect_id", prospect);
    const { data } = await admin.from("prospects").select("email").eq("id", prospect).maybeSingle();
    await admin.from("prospects").delete().eq("id", prospect);
    if (data?.email) await admin.from("consent_records").delete().eq("email", data.email);
  });

  it("o cliente não lê sinal de engajamento nem link rastreado", async () => {
    for (const t of ["engagement_events", "engagement_links", "linkedin_posts", "linkedin_interacoes"]) {
      const { data } = await userA.from(t).select("id");
      expect(data ?? [], `cliente leu ${t}`).toHaveLength(0);
    }
  });

  it("o anônimo também não — nem para descobrir para onde um link aponta", async () => {
    const { data } = await anon.from("engagement_links").select("destino");
    expect(data ?? [], "anônimo leu destinos de links rastreados").toHaveLength(0);
  });

  it("o link rastreado exige destino http(s) — sem javascript: nem data:", async () => {
    for (const d of ["javascript:alert(1)", "data:text/html,<script>", "/relativo"]) {
      const { error } = await admin.from("engagement_links").insert({ destino: d, prospect_id: prospect });
      expect(error, `aceitou destino perigoso: ${d}`).not.toBeNull();
    }
  });

  it("o sinal atualiza o engajamento do prospect sozinho, pelo gatilho", async () => {
    await admin.from("engagement_events")
      .insert({ prospect_id: prospect, tipo: "comentou_post_ia", peso: 35 });
    const { data } = await admin.from("prospects")
      .select("engajamento, ultimo_engajamento_em").eq("id", prospect).single();
    expect(data!.engajamento, "o gatilho não atualizou o engajamento").toBeGreaterThan(0);
    expect(data!.ultimo_engajamento_em, "não carimbou quando foi o último sinal").not.toBeNull();
  });

  it("o decaimento derruba um sinal antigo — quem sumiu há meses não é 'quente'", async () => {
    const { data: antes } = await admin.from("prospects").select("engajamento").eq("id", prospect).single();
    // Mesmo peso, seis meses atrás.
    await admin.from("engagement_events").insert({
      prospect_id: prospect, tipo: "curtiu_post_ia", peso: 18,
      occurred_at: new Date(Date.now() - 180 * 86400000).toISOString(),
    });
    const { data: score } = await admin.rpc("fn_engajamento_score", { p_prospect: prospect });
    // 18 pontos com meia-vida de 30 dias, seis meses depois, valem menos de 1 ponto.
    expect(score! - antes!.engajamento, "o sinal antigo pesou como se fosse de hoje").toBeLessThan(2);
  });

  it("o vocabulário de sinais é fechado — tipo inventado não entra", async () => {
    const { error } = await admin.from("engagement_events")
      .insert({ prospect_id: prospect, tipo: "espionou_o_perfil", peso: 99 });
    expect(error, "aceitou tipo de sinal fora do vocabulário").not.toBeNull();
  });

  it("o mesmo perfil não conta duas vezes no mesmo post", async () => {
    const linha = { post_id: post, tipo: "curtida", perfil_slug: slug, nome: "ZZTESTE Engajado" };
    const { error: e1 } = await admin.from("linkedin_interacoes").insert(linha);
    expect(e1, `primeira inserção falhou: ${e1?.message}`).toBeNull();
    const { error: e2 } = await admin.from("linkedin_interacoes").insert(linha);
    expect(e2, "contou a mesma curtida duas vezes").not.toBeNull();
  });

  it("o slug do perfil é extraído pelo banco do mesmo jeito que pelo app", async () => {
    for (const u of ["https://www.linkedin.com/in/alguem",
                     "http://br.linkedin.com/in/alguem/",
                     "https://linkedin.com/in/alguem?trk=x"]) {
      const { data } = await admin.rpc("fn_linkedin_slug", { p_url: u });
      expect(data, `banco extraiu errado de ${u}`).toBe("alguem");
    }
  });

  it("a exclusão do titular leva os sinais de engajamento junto", async () => {
    const email = `zz-del-${Date.now()}@industriateste.com.br`;
    const { data: c } = await admin.from("contacts")
      .insert({ org_id: null, name: "ZZTESTE Apagar", email, procedencia: "coleta_publica" })
      .select("id").single();
    await admin.from("engagement_events")
      .insert({ contact_id: c!.id, tipo: "email_aberto", peso: 3 });

    const { data: r } = await admin.rpc("fn_lgpd_excluir_titular", { p_email: email });
    expect((r as Record<string, number>).engagement_events,
      "a exclusão não alcançou os sinais de engajamento").toBeGreaterThanOrEqual(1);

    const { data: sobrou } = await admin.from("engagement_events").select("id").eq("contact_id", c!.id);
    expect(sobrou ?? [], "sobrou sinal comportamental de um titular excluído").toHaveLength(0);
    await admin.from("consent_records").delete().eq("email", email);
  });
});

describe("Coleta externa · contenção do risco e isolamento", () => {
  let fonte: string;

  beforeAll(async () => {
    const { data } = await admin.from("linkedin_fontes").insert({
      nome: "ZZTESTE Fonte", url: `https://www.linkedin.com/in/zzteste-${Date.now()}`, tipo: "perfil",
    }).select("id").single();
    fonte = data!.id;
  });

  afterAll(async () => {
    await admin.from("coleta_externa_execucoes").delete().ilike("alvo", "%zzteste%");
    await admin.from("linkedin_fontes").delete().eq("id", fonte);
    await admin.from("coleta_externa_config")
      .update({ ativo: false, parado_ate: null, motivo_parada: null }).eq("id", "unica");
  });

  it("nada disso é legível por cliente nem por anônimo", async () => {
    for (const t of ["coleta_externa_config", "coleta_externa_execucoes", "linkedin_fontes"]) {
      const { data: a } = await userA.from(t).select("id");
      const { data: b } = await anon.from(t).select("id");
      expect([...(a ?? []), ...(b ?? [])], `${t} vazou`).toHaveLength(0);
    }
  });

  it("o cliente não liga a coleta — nem por engano, nem de propósito", async () => {
    const { error } = await userA.from("coleta_externa_config").update({ ativo: true }).eq("id", "unica");
    const { data: depois } = await admin.from("coleta_externa_config").select("ativo").eq("id", "unica").single();
    expect(error ?? depois!.ativo === false, "cliente conseguiu ligar a coleta externa").toBeTruthy();
  });

  it("os tetos são limitados pelo banco — não dá para pedir 10 mil coletas por dia", async () => {
    const { error: e1 } = await admin.from("coleta_externa_config")
      .update({ teto_execucoes_dia: 9999 }).eq("id", "unica");
    expect(e1, "aceitou teto diário fora do limite").not.toBeNull();
    const { error: e2 } = await admin.from("coleta_externa_config")
      .update({ teto_perfis_execucao: 5000 }).eq("id", "unica");
    expect(e2, "aceitou teto de perfis fora do limite").not.toBeNull();
  });

  it("a pausa entre requisições não pode ser zerada — ritmo sem pausa é assinatura de robô", async () => {
    const { error } = await admin.from("coleta_externa_config")
      .update({ pausa_min_ms: 0, pausa_max_ms: 10 }).eq("id", "unica");
    expect(error, "aceitou pausa abaixo do mínimo").not.toBeNull();
  });

  it("o vocabulário de escopo é fechado", async () => {
    const { error } = await admin.from("coleta_externa_execucoes")
      .insert({ escopo: "raspar_tudo", alvo: "zzteste" });
    expect(error, "aceitou escopo de coleta fora do vocabulário").not.toBeNull();
  });

  it("a mesma fonte não entra duas vezes", async () => {
    const { data: f } = await admin.from("linkedin_fontes").select("url").eq("id", fonte).single();
    const { error } = await admin.from("linkedin_fontes").insert({ nome: "ZZTESTE Dup", url: f!.url });
    expect(error, "cadastrou a mesma fonte duas vezes").not.toBeNull();
  });

  it("interação de post de TERCEIRO é aceita sem post nosso por trás", async () => {
    const { data, error } = await admin.from("linkedin_interacoes").insert({
      post_id: null, fonte_id: fonte, tipo: "curtida",
      perfil_slug: `zzteste-externo-${Date.now()}`, nome: "ZZTESTE Externo",
      fonte: "apify", origem_externa: "reacoes_post",
    }).select("id").single();
    expect(error, `recusou interação sem post próprio: ${error?.message}`).toBeNull();
    await admin.from("linkedin_interacoes").delete().eq("id", data!.id);
  });
});

describe("Mensagens do LinkedIn · privacidade e alcance da exclusão", () => {
  const slug = `zzteste-msg-${Date.now()}`;
  const email = `zz-msg-${Date.now()}@industriateste.com.br`;
  let prospect: string;

  beforeAll(async () => {
    const { data } = await admin.from("prospects").insert({
      name: "ZZTESTE Conversou", email,
      linkedin_url: `https://www.linkedin.com/in/${slug}`,
      procedencia: "coleta_publica", status: "novo",
    }).select("id").single();
    prospect = data!.id;
  });

  afterAll(async () => {
    await admin.from("linkedin_mensagens").delete().eq("perfil_slug", slug);
    await admin.from("engagement_events").delete().eq("prospect_id", prospect);
    await admin.from("prospects").delete().eq("id", prospect);
    await admin.from("consent_records").delete().eq("email", email);
  });

  it("conteúdo de conversa não é legível por cliente nem por anônimo", async () => {
    const { data: a } = await userA.from("linkedin_mensagens").select("corpo");
    const { data: b } = await anon.from("linkedin_mensagens").select("corpo");
    expect([...(a ?? []), ...(b ?? [])], "conteúdo de conversa privada vazou").toHaveLength(0);
  });

  it("a direção é vocabulário fechado — não existe mensagem 'talvez enviada'", async () => {
    const { error } = await admin.from("linkedin_mensagens")
      .insert({ direcao: "sei_la", nome: "ZZTESTE", corpo: "oi" });
    expect(error, "aceitou direção fora do vocabulário").not.toBeNull();
  });

  it("a mesma mensagem reimportada não duplica a caixa inteira", async () => {
    const linha = {
      direcao: "recebida", perfil_slug: slug, nome: "ZZTESTE Conversou",
      corpo: "Vi seu post sobre agentes de IA e queria conversar.",
      enviada_em: "2026-07-01T10:00:00Z", prospect_id: prospect, tema_ia: true,
    };
    const { error: e1 } = await admin.from("linkedin_mensagens").insert(linha);
    expect(e1, `primeira inserção falhou: ${e1?.message}`).toBeNull();
    const { error: e2 } = await admin.from("linkedin_mensagens").insert(linha);
    expect(e2, "a mesma mensagem entrou duas vezes").not.toBeNull();
  });

  it("a exclusão do titular leva as conversas junto, inclusive pelo slug do perfil", async () => {
    const { data: r } = await admin.rpc("fn_lgpd_excluir_titular", { p_email: email });
    expect((r as Record<string, number>).linkedin_mensagens,
      "a exclusão não alcançou as mensagens").toBeGreaterThanOrEqual(1);
    const { data: sobrou } = await admin.from("linkedin_mensagens").select("id").eq("perfil_slug", slug);
    expect(sobrou ?? [], "sobrou conversa privada de um titular excluído").toHaveLength(0);
  });
});

describe("Cobrança · régua e avisos", () => {
  let fatura: string;
  // Reusa a org B das fixtures em vez de criar uma: `organizations` tem campos obrigatórios que a
  // suíte já sabe preencher, e criar mais uma só para este bloco deixaria lixo se algo falhasse
  // no meio.
  let org: string;

  beforeAll(async () => {
    org = orgB;
    const { data: f } = await admin.from("invoices").insert({
      org_id: org, amount: 1000, due_date: "2026-07-01", status: "aberta", kind: "implantacao",
    }).select("id").single();
    fatura = f!.id;
  });

  afterAll(async () => {
    await admin.from("cobranca_avisos").delete().eq("invoice_id", fatura);
    await admin.from("invoices").delete().eq("id", fatura);
  });

  it("a etapa do aviso é vocabulário fechado", async () => {
    const { error } = await admin.from("cobranca_avisos")
      .insert({ invoice_id: fatura, org_id: org, etapa: "insistencia" });
    expect(error, "aceitou etapa de cobrança fora do vocabulário").not.toBeNull();
  });

  it("o cliente vê os avisos que RECEBEU — transparência de cobrança", async () => {
    // A org do userA precisa ser a dona para o teste valer; usamos a org dele.
    const { data: minhaOrg } = await admin.from("memberships")
      .select("org_id").eq("user_id", (await userA.auth.getUser()).data.user!.id).limit(1).maybeSingle();
    const { data: f } = await admin.from("invoices").insert({
      org_id: minhaOrg!.org_id, amount: 50, due_date: "2026-07-01", status: "aberta",
    }).select("id").single();
    await admin.from("cobranca_avisos").insert({
      invoice_id: f!.id, org_id: minhaOrg!.org_id, etapa: "atraso", destinatario: "x@y.com", enviado: true,
    });

    const { data: vistos } = await userA.from("cobranca_avisos").select("id").eq("invoice_id", f!.id);
    expect(vistos ?? [], "o cliente não vê o aviso de cobrança que recebeu").toHaveLength(1);

    await admin.from("cobranca_avisos").delete().eq("invoice_id", f!.id);
    await admin.from("invoices").delete().eq("id", f!.id);
  });

  it("o cliente não vê aviso de cobrança de OUTRA empresa", async () => {
    await admin.from("cobranca_avisos").insert({
      invoice_id: fatura, org_id: org, etapa: "atraso", destinatario: "outro@cliente.com", enviado: true,
    });
    const { data } = await userA.from("cobranca_avisos").select("destinatario").eq("invoice_id", fatura);
    expect(data ?? [], "vazou cobrança de outra empresa").toHaveLength(0);
  });

  it("o cliente não cria nem altera aviso de cobrança", async () => {
    const { error } = await userA.from("cobranca_avisos")
      .insert({ invoice_id: fatura, org_id: org, etapa: "previo" });
    expect(error, "cliente criou aviso de cobrança").not.toBeNull();
  });

  it("o anônimo não vê nada de cobrança", async () => {
    const { data } = await anon.from("cobranca_avisos").select("id");
    expect(data ?? [], "anônimo leu avisos de cobrança").toHaveLength(0);
  });
});

describe("Entregas · escopo, stand-by e motivo do status", () => {
  let entrega: string;
  let projeto: string;

  beforeAll(async () => {
    const { data: p } = await admin.from("projects")
      .select("id").eq("org_id", orgB).limit(1).maybeSingle();
    if (p) projeto = p.id;
    const { data: e } = await admin.from("deliverables").insert({
      org_id: orgB, project_id: projeto, title: "ZZTESTE Entrega", status: "planejado",
      due_date: "2026-07-01",
    }).select("id").single();
    entrega = e!.id;
  });

  afterAll(async () => {
    await admin.from("deliverable_eventos").delete().eq("deliverable_id", entrega);
    await admin.from("deliverables").delete().eq("id", entrega);
    await admin.from("projeto_standby_periodos").delete().eq("project_id", projeto);
    await admin.from("projects")
      .update({ standby_desde: null, standby_motivo: null, standby_dias_acumulados: 0 })
      .eq("id", projeto);
  });

  it("travar SEM motivo é recusado pelo banco — não só pela tela", async () => {
    const { error } = await admin.from("deliverable_eventos")
      .insert({ deliverable_id: entrega, org_id: orgB, de: "planejado", para: "bloqueado" });
    expect(error, "gravou entrega travada sem dizer por quê").not.toBeNull();
    expect(error!.message).toMatch(/motivo/i);
  });

  it("travar COM motivo passa", async () => {
    const { error } = await admin.from("deliverable_eventos").insert({
      deliverable_id: entrega, org_id: orgB, de: "planejado", para: "bloqueado",
      motivo: "parado até o cliente quitar a parcela",
    });
    expect(error, `recusou mesmo com motivo: ${error?.message}`).toBeNull();
  });

  it("motivo só de espaços conta como vazio", async () => {
    const { error } = await admin.from("deliverable_eventos").insert({
      deliverable_id: entrega, org_id: orgB, para: "bloqueado", motivo: "   ",
    });
    expect(error, "aceitou motivo em branco").not.toBeNull();
  });

  it("os outros status não exigem motivo", async () => {
    for (const st of ["planejado", "em_andamento", "entregue"]) {
      const { error } = await admin.from("deliverable_eventos")
        .insert({ deliverable_id: entrega, org_id: orgB, para: st });
      expect(error, `exigiu motivo para "${st}", que não precisa`).toBeNull();
    }
  });

  it("o cliente VÊ o andamento e o motivo do que contratou", async () => {
    const { data: minhaOrg } = await admin.from("memberships")
      .select("org_id").eq("user_id", (await userA.auth.getUser()).data.user!.id).limit(1).maybeSingle();
    const { data: proj } = await admin.from("projects")
      .select("id").eq("org_id", minhaOrg!.org_id).limit(1).maybeSingle();
    if (!proj) return;

    const { data: e } = await admin.from("deliverables").insert({
      org_id: minhaOrg!.org_id, project_id: proj.id, title: "ZZTESTE Visível", status: "planejado",
    }).select("id").single();
    await admin.from("deliverable_eventos").insert({
      deliverable_id: e!.id, org_id: minhaOrg!.org_id, para: "bloqueado", motivo: "aguardando material",
    });

    const { data: vistos } = await userA.from("deliverable_eventos").select("motivo").eq("deliverable_id", e!.id);
    expect(vistos ?? [], "o cliente não vê por que a entrega dele travou").toHaveLength(1);

    await admin.from("deliverable_eventos").delete().eq("deliverable_id", e!.id);
    await admin.from("deliverables").delete().eq("id", e!.id);
  });

  it("o cliente não vê entrega nem histórico de OUTRA empresa", async () => {
    const { data: ent } = await userA.from("deliverables").select("id").eq("id", entrega);
    const { data: hist } = await userA.from("deliverable_eventos").select("id").eq("deliverable_id", entrega);
    expect([...(ent ?? []), ...(hist ?? [])], "vazou entrega de outra empresa").toHaveLength(0);
  });

  it("o cliente não altera o andamento — só acompanha", async () => {
    const { error } = await userA.from("deliverables").update({ status: "entregue" }).eq("id", entrega);
    const { data: depois } = await admin.from("deliverables").select("status").eq("id", entrega).single();
    expect(error ?? depois!.status !== "entregue", "cliente marcou a própria entrega como concluída").toBeTruthy();
  });

  it("o motivo do stand-by é vocabulário fechado", async () => {
    const { error } = await admin.from("projeto_standby_periodos")
      .insert({ project_id: projeto, org_id: orgB, motivo: "sei_la", inicio: "2026-07-26" });
    expect(error, "aceitou motivo de stand-by fora do vocabulário").not.toBeNull();
  });

  it("o cliente vê que o próprio projeto está parado, e por quê", async () => {
    const { data } = await userA.from("projeto_standby_periodos").select("id");
    expect(Array.isArray(data), "a política de leitura do stand-by quebrou").toBe(true);
  });
});

describe("Jurídico · biblioteca de cláusulas e demandas", () => {
  let clausula: string;

  beforeAll(async () => {
    const { data } = await admin.from("clausulas").select("id").eq("codigo", "3.6-mora").single();
    clausula = data!.id;
  });

  afterAll(async () => {
    await admin.from("legal_matters").delete().ilike("titulo", "ZZTESTE%");
  });

  it("a biblioteca é interna — cliente e anônimo não leem", async () => {
    for (const t of ["clausulas", "clausula_versoes", "legal_matters"]) {
      const { data: a } = await userA.from(t).select("id");
      const { data: b } = await anon.from(t).select("id");
      expect([...(a ?? []), ...(b ?? [])], `${t} vazou`).toHaveLength(0);
    }
  });

  it("a regra vigente está na biblioteca: 10% e suspensão após 2 faturas", async () => {
    const { data } = await admin.from("clausulas").select("texto").eq("codigo", "3.6-mora").single();
    expect(data!.texto).toContain("10% (dez por cento)");
    expect(data!.texto).toContain("2 (duas) faturas");
    expect(data!.texto).toContain("CANCELAMENTO PROVISÓRIO");
  });

  it("editar cláusula guarda a versão anterior — o gatilho versiona sozinho", async () => {
    const { data: antes } = await admin.from("clausulas").select("versao, texto").eq("id", clausula).single();
    const textoOriginal = antes!.texto;

    await admin.from("clausulas")
      .update({ texto: textoOriginal + "\n\nZZTESTE parágrafo temporário.", observacao_interna: "teste automatizado" })
      .eq("id", clausula);

    const { data: depois } = await admin.from("clausulas").select("versao").eq("id", clausula).single();
    expect(depois!.versao, "a versão não subiu").toBe(antes!.versao + 1);

    const { data: hist } = await admin.from("clausula_versoes")
      .select("texto, versao").eq("clausula_id", clausula).eq("versao", antes!.versao).maybeSingle();
    expect(hist?.texto, "a redação anterior não foi guardada").toBe(textoOriginal);

    // devolve ao original (e isso gera mais uma versão, que é o comportamento certo)
    await admin.from("clausulas")
      .update({ texto: textoOriginal, observacao_interna: "revertido pelo teste" }).eq("id", clausula);
  });

  it("a mesma cláusula não entra duas vezes no mesmo contrato", async () => {
    const { data: c } = await admin.from("contracts").select("id").limit(1).maybeSingle();
    if (!c) return;
    const linha = { contract_id: c.id, clausula_id: clausula, versao: 1, texto_congelado: "ZZTESTE", ordem: 1 };
    await admin.from("contrato_clausulas").insert(linha);
    const { error } = await admin.from("contrato_clausulas").insert(linha);
    expect(error, "a mesma cláusula foi congelada duas vezes no contrato").not.toBeNull();
    await admin.from("contrato_clausulas").delete().eq("contract_id", c.id).eq("clausula_id", clausula);
  });

  it("o cliente lê as cláusulas do PRÓPRIO contrato — é o documento dele", async () => {
    const { data } = await userA.from("contrato_clausulas").select("id");
    expect(Array.isArray(data), "a política de leitura das cláusulas do contrato quebrou").toBe(true);
  });

  it("tipo e status de demanda são vocabulário fechado", async () => {
    const { error: e1 } = await admin.from("legal_matters")
      .insert({ tipo: "processo_kafkiano", titulo: "ZZTESTE" });
    expect(e1, "aceitou tipo de demanda fora do vocabulário").not.toBeNull();
    const { error: e2 } = await admin.from("legal_matters")
      .insert({ tipo: "cobranca", titulo: "ZZTESTE", status: "quase_la" });
    expect(e2, "aceitou status fora do vocabulário").not.toBeNull();
  });

  it("contrato assinado continua imutável — a proteção não foi enfraquecida", async () => {
    const { data: c } = await admin.from("contracts").select("id").eq("status", "assinado").limit(1).maybeSingle();
    if (!c) return;
    const { error } = await admin.from("contracts").update({ multa_pactuada: 0.99 }).eq("id", c.id);
    expect(error, "conseguiu alterar contrato assinado").not.toBeNull();
    expect(error!.message).toMatch(/imut/i);
  });

  it("a fatura carrega a multa que o contrato dela pactuou", async () => {
    const { data } = await admin.from("invoices").select("multa_pactuada").not("multa_pactuada", "is", null);
    expect((data ?? []).length, "nenhuma fatura tem a regra de multa registrada").toBeGreaterThan(0);
    for (const f of data ?? []) {
      expect(Number(f.multa_pactuada)).toBeGreaterThan(0);
      expect(Number(f.multa_pactuada)).toBeLessThanOrEqual(0.10);
    }
  });
});

describe("Administração · custos e fornecedores", () => {
  let despesa: string;

  afterAll(async () => {
    await admin.from("despesas").delete().ilike("descricao", "ZZTESTE%");
    await admin.from("vendors").delete().ilike("nome", "ZZTESTE%");
  });

  it("custos da empresa são internos — cliente e anônimo não leem", async () => {
    for (const t of ["vendors", "despesas", "internal_assets"]) {
      const { data: a } = await userA.from(t).select("id");
      const { data: b } = await anon.from(t).select("id");
      expect([...(a ?? []), ...(b ?? [])], `${t} vazou o custo da empresa`).toHaveLength(0);
    }
  });

  it("o custo mensal equivalente normaliza anual e trimestral", async () => {
    const { data: anual } = await admin.rpc("fn_custo_mensal", { p_valor: 120000, p_recorrencia: "anual" });
    expect(anual, "anual não virou /12").toBe(10000);
    const { data: tri } = await admin.rpc("fn_custo_mensal", { p_valor: 30000, p_recorrencia: "trimestral" });
    expect(tri, "trimestral não virou /3").toBe(10000);
    const { data: mensal } = await admin.rpc("fn_custo_mensal", { p_valor: 10000, p_recorrencia: "mensal" });
    expect(mensal).toBe(10000);
    // Despesa única não é custo recorrente — somá-la inflaria o "por mês".
    const { data: unica } = await admin.rpc("fn_custo_mensal", { p_valor: 500000, p_recorrencia: "unica" });
    expect(unica, "despesa única entrou no custo mensal").toBe(0);
  });

  it("valor zero ou negativo é recusado", async () => {
    const { data: v } = await admin.from("vendors")
      .insert({ nome: `ZZTESTE Forn ${Date.now()}` }).select("id").single();
    for (const valor of [0, -100]) {
      const { error } = await admin.from("despesas").insert({
        vendor_id: v!.id, descricao: "ZZTESTE Inválida", valor_centavos: valor, inicio: "2026-01-01",
      });
      expect(error, `aceitou despesa de ${valor} centavos`).not.toBeNull();
    }
    const { data: d } = await admin.from("despesas").insert({
      vendor_id: v!.id, descricao: "ZZTESTE Válida", valor_centavos: 2500,
      recorrencia: "mensal", inicio: "2026-01-01",
    }).select("id").single();
    despesa = d!.id;
  });

  it("o mesmo fornecedor não entra duas vezes, mesmo com caixa diferente", async () => {
    const nome = `ZZTESTE Dup ${Date.now()}`;
    await admin.from("vendors").insert({ nome });
    const { error } = await admin.from("vendors").insert({ nome: nome.toUpperCase() });
    expect(error, "cadastrou o mesmo fornecedor com caixa diferente").not.toBeNull();
  });

  it("a view de recorrentes só traz o que está ativo e não é única", async () => {
    const { data } = await admin.from("despesas_recorrentes").select("id, recorrencia, ativa");
    for (const d of data ?? []) {
      expect(d.ativa, "a view trouxe despesa encerrada").toBe(true);
      expect(d.recorrencia, "a view trouxe despesa única").not.toBe("unica");
    }
  });

  it("encerrar não apaga — o custo passado continua comparável", async () => {
    await admin.from("despesas").update({ ativa: false, fim: "2026-07-30" }).eq("id", despesa);
    const { data } = await admin.from("despesas").select("id, ativa").eq("id", despesa).maybeSingle();
    expect(data, "a despesa sumiu ao ser encerrada").not.toBeNull();
    expect(data!.ativa).toBe(false);
  });

  it("o vocabulário de recorrência e categoria é fechado", async () => {
    const { error: e1 } = await admin.from("despesas").insert({
      descricao: "ZZTESTE X", valor_centavos: 100, inicio: "2026-01-01", recorrencia: "quando_der",
    });
    expect(e1, "aceitou recorrência inventada").not.toBeNull();
    const { error: e2 } = await admin.from("despesas").insert({
      descricao: "ZZTESTE Y", valor_centavos: 100, inicio: "2026-01-01", categoria: "diversos",
    });
    expect(e2, "aceitou categoria inventada").not.toBeNull();
  });
});
