-- ═══════════════════════════════════════════════════════════════════
-- AI OPERATION SYSTEM (AI OS) · Schema v4.0 · Migration 000
-- Multi-tenant · RLS em 100% das tabelas · Claude-first
-- Salestrack Inteligência Digital LTDA · ai-os.salestrack.com.br
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ───────────────────────────────────────────────
-- ENUMS
-- ───────────────────────────────────────────────
create type membership_role as enum ('salestrack_admin','sponsor','gestor_frente','colaborador','financeiro');
create type org_plan as enum ('essential','professional','enterprise');
create type org_status as enum ('prospect','onboarding','ativo','pausado','encerrado');
create type brand_owner as enum ('andre_kachan','salestrack','ai_os');
create type deal_stage as enum ('sinal','qualificado','diagnostico','proposta','fechamento','cliente','perdido');
create type proposal_status as enum ('rascunho','enviada','em_leitura','aprovada','ajuste_solicitado','recusada','expirada');
create type contract_status as enum ('minuta','enviado','assinado','cancelado');
create type session_type as enum ('sessao_estrategica','sprint_30d','mentoria_trimestral','workshop','palestra','treinamento','ai_academy','ai_labs','diagnostico_stack');
create type session_status as enum ('agendada','realizada','cancelada','no_show');
create type ai_ring as enum ('anel_1','anel_2','anel_3');
create type recipe_level as enum ('iniciante','intermediario','avancado');
create type recipe_profile as enum ('c_level','gestor','operacional');
create type deliverable_status as enum ('planejado','em_andamento','entregue','bloqueado');
create type wa_provider as enum ('zapi','meta_cloud');
create type branding_level as enum ('n1_padrao','n2_personalizado','n3_whitelabel');

-- ───────────────────────────────────────────────
-- NÚCLEO MULTI-TENANT
-- ───────────────────────────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  cnpj text,
  plan org_plan not null default 'professional',
  status org_status not null default 'prospect',
  stripe_customer_id text,
  icp smallint check (icp between 1 and 3),
  is_salestrack boolean not null default false,   -- org interna Salestrack
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'colaborador',
  frente text,                                     -- gestor_frente: qual frente
  mfa_enrolled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table tenant_branding (
  org_id uuid primary key references organizations(id) on delete cascade,
  level branding_level not null default 'n1_padrao',
  internal_name text,                              -- ex: "ART MG Inteligência"
  logo_url text,
  color_primary text, color_accent text, color_bg text,
  updated_at timestamptz not null default now()
);

create table custom_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  domain text unique not null,                     -- ia.cliente.com.br
  dns_status text not null default 'pendente',     -- pendente|verificado|erro
  ssl_status text not null default 'pendente',
  email_dkim_status text not null default 'pendente',
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────
-- AUDITORIA IMUTÁVEL (hash encadeado)
-- ───────────────────────────────────────────────
create table audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid references organizations(id),
  actor_id uuid,
  action text not null,
  resource text not null,
  resource_id text,
  payload jsonb,
  ip inet,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now()
);
-- imutável: sem update/delete (nenhuma policy os concede; revogar de authenticated)
revoke update, delete on audit_logs from authenticated, anon;

create or replace function fn_audit_hash() returns trigger
language plpgsql security definer as $$
declare last_hash text;
begin
  select hash into last_hash from audit_logs order by id desc limit 1;
  new.prev_hash := coalesce(last_hash, 'GENESIS');
  new.hash := encode(digest(
    new.prev_hash || coalesce(new.actor_id::text,'') || new.action ||
    new.resource || coalesce(new.resource_id,'') || coalesce(new.payload::text,'') ||
    now()::text, 'sha256'), 'hex');
  return new;
end $$;
create trigger trg_audit_hash before insert on audit_logs
  for each row execute function fn_audit_hash();

-- ───────────────────────────────────────────────
-- UNIVERSO MULTI-IA (v4)
-- ───────────────────────────────────────────────
create table ai_platforms (                        -- catálogo global (sem tenant)
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                       -- Claude, ChatGPT, Gemini, n8n...
  vendor text,
  ring ai_ring not null,
  category text,                                   -- generativa|orquestracao|midia|vertical
  capabilities text[],
  api_available boolean not null default false,
  notes text
);

create table client_ai_stack (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  platform_id uuid not null references ai_platforms(id),
  plan text, seats int, monthly_cost numeric(12,2),
  owner_name text,                                 -- dono interno no cliente
  frentes text[],
  data_policy text,                                -- o que pode entrar nesta IA
  status text not null default 'ativo',            -- ativo|avaliacao|desativado|shadow
  created_at timestamptz not null default now(),
  unique (org_id, platform_id)
);

create table orchestrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  tool text not null,                              -- n8n | make | zapier | outro
  name text not null,
  description text,
  flow_doc jsonb,                                  -- documentação estruturada do fluxo
  version int not null default 1,
  owner_name text,
  status text not null default 'ativo',
  library_asset_id uuid,
  created_at timestamptz not null default now()
);

create table platform_benchmarks (                 -- base anonimizada (sem tenant)
  id uuid primary key default gen_random_uuid(),
  use_case text not null,
  platform_id uuid not null references ai_platforms(id),
  time_minutes numeric, quality_score numeric, rework_rate numeric,
  sample_size int not null default 1,
  updated_at timestamptz not null default now()
);

create table ai_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  version int not null default 1,
  content_md text not null,
  data_classification jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references ai_policies(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  accepted_at timestamptz not null default now(),
  unique (policy_id, user_id)
);

-- ───────────────────────────────────────────────
-- CONECTORES (Anel 1 MCP + Anéis 2-3 Open API)
-- ───────────────────────────────────────────────
create table claude_workspaces (
  org_id uuid primary key references organizations(id) on delete cascade,
  plan text,                                       -- team | enterprise
  seats int,
  contract_status text not null default 'pendente',-- pendente|contratado|ativo
  connected_at timestamptz
);

create table connector_tokens (                    -- MCP · Claude
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null,
  scopes text[] not null default '{biblioteca,playbook,contexto,memoria}',
  last_seen timestamptz,
  status text not null default 'ativo',            -- ativo|revogado
  created_at timestamptz not null default now()
);

create table openapi_tokens (                      -- REST · Anéis 2-3
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  platform_id uuid references ai_platforms(id),
  token_hash text not null,
  scopes text[] not null default '{biblioteca_leitura,playbook_leitura}',
  rate_limit_per_min int not null default 60,
  last_seen timestamptz,
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);

create table skill_deployments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  skill_name text not null,
  version text not null,
  changelog text,
  deployed_at timestamptz not null default now(),
  rolled_back boolean not null default false
);

-- ───────────────────────────────────────────────
-- PLAYBOOK DE IA
-- ───────────────────────────────────────────────
create table playbook_use_cases (                  -- caso de uso agrupa versões por plataforma
  id uuid primary key default gen_random_uuid(),
  title text not null,
  frente text not null,
  created_at timestamptz not null default now()
);

create table playbook_recipes (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid references playbook_use_cases(id),
  platform_id uuid not null references ai_platforms(id),
  title text not null,
  frente text not null,
  profile recipe_profile not null,
  level recipe_level not null default 'iniciante',
  time_minutes int,
  what_md text not null,          -- o quê
  why_md text not null,           -- por quê
  gain_md text not null,          -- ganho estimado (benchmark)
  steps jsonb not null,           -- [{n, titulo, texto}]
  prompt_text text,
  skill_name text,
  video_url text,
  version int not null default 1,
  published boolean not null default false,
  plans org_plan[] not null default '{essential,professional,enterprise}',
  exclusive_org_id uuid references organizations(id),  -- receita exclusiva enterprise
  is_recommended boolean not null default false,       -- ★ versão recomendada do caso de uso
  created_at timestamptz not null default now()
);

create table recipe_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  recipe_id uuid not null references playbook_recipes(id),
  status text not null default 'iniciada',         -- iniciada|concluida
  feedback text,
  completed_at timestamptz,
  unique (org_id, user_id, recipe_id)
);

create table trilhas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  profile recipe_profile not null,
  frente text,
  recipe_ids uuid[] not null default '{}',
  certificate boolean not null default false
);

-- ───────────────────────────────────────────────
-- SESSÕES AO VIVO (AK + Salestrack)
-- ───────────────────────────────────────────────
create table sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type session_type not null,
  brand brand_owner not null default 'andre_kachan',
  title text not null,
  status session_status not null default 'agendada',
  scheduled_at timestamptz,
  calendly_ref text, gcal_event_id text, meet_link text,
  readai_ref text, summary_md text, action_items jsonb,
  recording_url text,
  attendees jsonb,                                 -- [{name,email,present}]
  created_at timestamptz not null default now()
);

create table session_credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type session_type not null,
  total int not null,
  consumed int not null default 0,
  valid_until date,
  unique (org_id, type)
);

-- ───────────────────────────────────────────────
-- CRM
-- ───────────────────────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),        -- null = lead sem org criada
  name text not null, email text, phone text, role text,
  linkedin_url text,
  opt_in_whatsapp boolean not null default false,
  opt_in_registered_at timestamptz,
  apollo_id text,
  created_at timestamptz not null default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  contact_id uuid references contacts(id),
  title text not null,
  stage deal_stage not null default 'sinal',
  icp smallint check (icp between 1 and 3),
  score int not null default 0,                    -- protocolo de sinais (≥20 aborda)
  signals jsonb,
  value_estimated numeric(12,2),
  brand brand_owner not null default 'andre_kachan',
  detected_stack jsonb,                            -- stack de IA do prospect (v4)
  lost_reason text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────
-- CATÁLOGO · PROPOSTAS · CONTRATOS
-- ───────────────────────────────────────────────
create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null,        -- mentoria|workshop|palestra|treinamento|produto|agente|plano_aios|addon
  brand brand_owner not null,
  name text not null,
  description text,
  unit text not null default 'un',                 -- un|mes|hora|sessao
  price numeric(12,2),
  cost numeric(12,2),
  active boolean not null default true,
  needs_review boolean not null default false,     -- preço a confirmar
  created_at timestamptz not null default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  deal_id uuid references deals(id),
  version int not null default 1,
  status proposal_status not null default 'rascunho',
  title text not null,
  frentes text[],
  items jsonb not null,       -- [{catalog_item_id, qty, price, brand}]
  platform_plan_md text,      -- bloco plano de plataforma (v4)
  monthly_platform_fee numeric(12,2),              -- linha "Plataforma AI OS"
  installments int,
  html text,                  -- proposta renderizada
  content_hash text,          -- imutabilidade após aprovação
  sent_at timestamptz, decided_at timestamptz,
  read_analytics jsonb,       -- [{section, seconds}]
  decision_note text,
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  proposal_id uuid not null references proposals(id),
  status contract_status not null default 'minuta',
  docusign_envelope_id text,
  signed_pdf_url text,
  content_hash text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- imutabilidade: proposta aprovada / contrato assinado não podem ser alterados
create or replace function fn_lock_approved() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'proposals' and old.status = 'aprovada' then
    raise exception 'Proposta aprovada é imutável (AI OS)';
  end if;
  if tg_table_name = 'contracts' and old.status = 'assinado' then
    raise exception 'Contrato assinado é imutável (AI OS)';
  end if;
  return new;
end $$;
create trigger trg_lock_proposal before update or delete on proposals
  for each row execute function fn_lock_approved();
create trigger trg_lock_contract before update or delete on contracts
  for each row execute function fn_lock_approved();

-- ───────────────────────────────────────────────
-- PROGRAMA · ENTREGA
-- ───────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contract_id uuid references contracts(id),
  name text not null,
  phase text not null default 'kickoff',
  timeline jsonb,             -- fases e marcos (padrão ART MG)
  progress_pct numeric(5,2) not null default 0,
  health_score int,
  created_at timestamptz not null default now()
);

create table deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  frente text, title text not null,
  status deliverable_status not null default 'planejado',
  due_date date, delivered_at timestamptz,
  artifact_asset_id uuid
);

create table library_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,  -- null = repositório-mestre
  type text not null,         -- skill|prompt|playbook|documento|gravacao|automacao
  frente text, title text not null,
  version int not null default 1,
  storage_path text, url text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────
-- AGENTES · MEMÓRIA
-- ───────────────────────────────────────────────
create table agents (
  id uuid primary key default gen_random_uuid(),
  casa text not null default 'salestrack',         -- salestrack | cliente
  name text not null,
  system_prompt text,
  prompt_version int not null default 1,
  metrics jsonb,
  active boolean not null default true
);

create table agent_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  agent_id uuid references agents(id),
  channel text not null default 'portal',          -- portal|whatsapp|slack|email
  wa_provider wa_provider,
  messages jsonb not null default '[]',
  tokens_used int not null default 0,
  created_at timestamptz not null default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade, -- null = camada negócio/operacional
  scope text not null,        -- cliente|negocio|operacional
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index idx_memories_embedding on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ───────────────────────────────────────────────
-- BILLING · TIMELINE
-- ───────────────────────────────────────────────
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  stripe_subscription_id text,
  plan org_plan not null,
  monthly_amount numeric(12,2),
  addons jsonb,               -- [{name, amount}]
  status text not null default 'ativa',
  started_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  stripe_invoice_id text, amount numeric(12,2),
  status text, due_date date, paid_at timestamptz
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  actor_id uuid,
  kind text not null,         -- email|calendar|readai|whatsapp|sistema|proposta|sessao
  ref_table text, ref_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index idx_activities_org_time on activities(org_id, created_at desc);

-- ═══════════════════════════════════════════════
-- RLS · 100% DAS TABELAS
-- ═══════════════════════════════════════════════
create or replace function is_salestrack_admin() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from memberships m
    join organizations o on o.id = m.org_id
    where m.user_id = auth.uid() and m.role = 'salestrack_admin' and o.is_salestrack
  );
$$;

create or replace function user_org_ids() returns setof uuid
language sql stable security definer as $$
  select org_id from memberships where user_id = auth.uid();
$$;

-- helper para aplicar o padrão tenant em lote
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','memberships','tenant_branding','custom_domains','audit_logs',
    'client_ai_stack','orchestrations','ai_policies','ai_policy_acceptances',
    'claude_workspaces','connector_tokens','openapi_tokens','skill_deployments',
    'recipe_progress','sessions','session_credits','contacts','deals',
    'proposals','contracts','projects','deliverables','library_assets',
    'agent_conversations','memories','subscriptions','invoices','activities',
    'ai_platforms','platform_benchmarks','playbook_use_cases','playbook_recipes',
    'trilhas','catalog_items','agents'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Admin Salestrack: acesso total
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','memberships','tenant_branding','custom_domains','audit_logs',
    'client_ai_stack','orchestrations','ai_policies','ai_policy_acceptances',
    'claude_workspaces','connector_tokens','openapi_tokens','skill_deployments',
    'recipe_progress','sessions','session_credits','contacts','deals',
    'proposals','contracts','projects','deliverables','library_assets',
    'agent_conversations','memories','subscriptions','invoices','activities',
    'ai_platforms','platform_benchmarks','playbook_use_cases','playbook_recipes',
    'trilhas','catalog_items','agents'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin())',
      'admin_all_'||t, t);
  end loop;
end $$;

-- Cliente: leitura da própria org (tabelas com org_id)
do $$
declare t text;
begin
  foreach t in array array[
    'tenant_branding','custom_domains','client_ai_stack','orchestrations',
    'ai_policies','claude_workspaces','skill_deployments','sessions','session_credits',
    'proposals','contracts','projects','deliverables','library_assets',
    'agent_conversations','subscriptions','invoices','activities'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (org_id in (select user_org_ids()))',
      'tenant_read_'||t, t);
  end loop;
end $$;

-- Regras específicas do cliente
create policy tenant_read_own_org on organizations for select to authenticated
  using (id in (select user_org_ids()));
create policy tenant_read_memberships on memberships for select to authenticated
  using (org_id in (select user_org_ids()));
create policy tenant_progress_rw on recipe_progress for all to authenticated
  using (org_id in (select user_org_ids()) and user_id = auth.uid())
  with check (org_id in (select user_org_ids()) and user_id = auth.uid());
create policy tenant_accept_policy on ai_policy_acceptances for insert to authenticated
  with check (org_id in (select user_org_ids()) and user_id = auth.uid());
create policy tenant_read_acceptances on ai_policy_acceptances for select to authenticated
  using (org_id in (select user_org_ids()));

-- Catálogos globais: leitura para autenticados
create policy read_ai_platforms on ai_platforms for select to authenticated using (true);
create policy read_benchmarks on platform_benchmarks for select to authenticated using (true);
create policy read_use_cases on playbook_use_cases for select to authenticated using (true);
create policy read_trilhas on trilhas for select to authenticated using (true);
create policy read_recipes on playbook_recipes for select to authenticated
  using (published and (exclusive_org_id is null or exclusive_org_id in (select user_org_ids())));

-- library_assets: cliente lê os da própria org + repositório-mestre publicado
create policy tenant_read_master_assets on library_assets for select to authenticated
  using (org_id is null);

-- audit: cliente lê o próprio rastro (inserção só via service role/definer)
create policy tenant_read_audit on audit_logs for select to authenticated
  using (org_id in (select user_org_ids()));
