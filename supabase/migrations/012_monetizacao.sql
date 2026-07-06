-- AI OS · Migration 012 · Fase 6: Monetização (planos, assinaturas, white-label, governança)
-- (renumerada de 009 no prompt → 012). ESTENDE tabelas existentes; não recria.
--   subscriptions/invoices/tenant_branding já existem (Fase 3/4a) → ALTER.
--   plans/ai_stack_entries/governance_policies → novas.
-- Fronteira: Stripe = cobrança da Salestrack; C3 (ai_stack_entries) é DECLARATIVO (nada conecta).

-- Catálogo global de planos
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,                 -- base | pro | enterprise
  name text not null,
  price_monthly numeric not null default 0,
  stripe_price_id text,
  features jsonb not null default '{}',      -- playbook, consultor, sessoes, roi, whitelabel_n2/n3, governanca_avancada, limite_membros, creditos_sessao_mes
  is_active boolean not null default true,
  ordem int not null default 0
);

-- subscriptions: estende a existente (mantém plan/monthly_amount/status/started_at)
alter table subscriptions add column if not exists plan_key text;
alter table subscriptions add column if not exists monthly_platform_fee numeric;
alter table subscriptions add column if not exists current_period_end timestamptz;
alter table subscriptions add column if not exists updated_at timestamptz not null default now();

-- tenant_branding: estende N1 existente (já tem level enum + color_primary/color_accent/logo_url/internal_name)
alter table tenant_branding add column if not exists custom_domain text;

-- Meu Stack de IA (C3, declarativo) — registro, nada conecta
create table if not exists ai_stack_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  platform_name text not null,
  purpose text,
  data_classification text not null default 'interno', -- publico|interno|confidencial|restrito
  authorized_data text,
  owner text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_stack_org on ai_stack_entries(org_id);

-- Política de uso de IA / governança (produto vendável)
create table if not exists governance_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade unique,
  policy_md text,
  security_summary_md text,
  published boolean not null default false,
  public_token text unique default replace(gen_random_uuid()::text,'-',''),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table plans enable row level security;
alter table ai_stack_entries enable row level security;
alter table governance_policies enable row level security;

-- plans: leitura por autenticado; escrita só admin
create policy plans_read  on plans for select to authenticated using (true);
create policy plans_admin on plans for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

-- ai_stack_entries: por org (cliente edita o próprio) + admin
create policy stack_own on ai_stack_entries for all to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin())
  with check (org_id in (select user_org_ids()) or is_salestrack_admin());

-- governance_policies: org lê a sua; escrita org+admin (client_admin gate no app). Página pública via service role.
create policy gov_read on governance_policies for select to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin());
create policy gov_write on governance_policies for all to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin())
  with check (org_id in (select user_org_ids()) or is_salestrack_admin());
