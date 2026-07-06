-- AI OS · Migration 013 · Fase 7: Observabilidade & FinOps (renumerada de 010 no prompt → 013)
-- TODA a camada é OPERACIONAL INTERNA da Salestrack → RLS admin-only. Nenhuma org-cliente enxerga.
-- Nota: a telemetria da Fase 5 é messages.tokens (total) + conversations.agent_key (sem model/in-out por msg);
--       o custo é aproximado por preço combinado do modelo configurado.

create table if not exists model_prices (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  price_in_per_mtok numeric not null default 0,   -- USD por 1M tokens de entrada
  price_out_per_mtok numeric not null default 0,  -- USD por 1M tokens de saída
  currency text not null default 'USD',
  effective_from date not null default current_date,
  is_active boolean not null default true
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  module text not null, action text, actor uuid,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_usage_org on usage_events(org_id, occurred_at desc);

create table if not exists ai_cost_daily (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  date date not null, agent_key text, model text,
  tokens_in bigint not null default 0, tokens_out bigint not null default 0,
  cost_usd numeric not null default 0, computed_at timestamptz not null default now(),
  unique (org_id, date, agent_key, model)
);
create index if not exists idx_cost_org_date on ai_cost_daily(org_id, date);

create table if not exists tenant_health (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  date date not null,
  engagement_score int not null default 0,
  mrr numeric not null default 0, ai_cost_usd numeric not null default 0, margin_usd numeric not null default 0,
  churn_risk text not null default 'baixo', signals jsonb not null default '{}', computed_at timestamptz not null default now(),
  unique (org_id, date)
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null, severity text not null default 'aviso',
  org_id uuid references organizations(id) on delete cascade,
  message text not null, status text not null default 'aberto',
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create index if not exists idx_alerts_status on alerts(status, created_at desc);

alter table model_prices  enable row level security;
alter table usage_events  enable row level security;
alter table ai_cost_daily enable row level security;
alter table tenant_health enable row level security;
alter table alerts        enable row level security;

create policy mp_admin  on model_prices  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy ue_admin  on usage_events  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy cost_admin on ai_cost_daily for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy th_admin  on tenant_health for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy al_admin  on alerts        for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
