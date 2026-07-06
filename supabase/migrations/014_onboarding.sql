-- AI OS · Migration 014 · Fase 8: Onboarding self-service de tenant (renumerada de 011 → 014)
-- REUSA `invites` (Fase 4a, já tem token+expires+accepted + fluxo /convite/[token]) em vez de criar `invitations`.
-- program_templates/tenant_provisioning/onboarding_checklists → novas.

create table if not exists program_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, name text not null, description text,
  structure jsonb not null default '{}',   -- frentes, entregaveis, timeline, agentes, biblioteca
  is_active boolean not null default true
);

create table if not exists tenant_provisioning (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  status text not null default 'pendente', -- pendente|provisionando|pronto|falhou
  steps jsonb not null default '[]',        -- [{passo, status, erro?}]
  source text not null default 'manual',    -- manual|deal
  deal_id uuid references deals(id) on delete set null,
  template_key text, created_by uuid,
  created_at timestamptz not null default now(), completed_at timestamptz
);

create table if not exists onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade unique,
  items jsonb not null default '[]',        -- [{key,label,done,done_at}]
  completed_at timestamptz
);

alter table program_templates    enable row level security;
alter table tenant_provisioning  enable row level security;
alter table onboarding_checklists enable row level security;

create policy pt_admin on program_templates   for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy tp_admin on tenant_provisioning for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
-- checklist: membros da org leem/atualizam o seu; admin tudo
create policy oc_own on onboarding_checklists for all to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin())
  with check (org_id in (select user_org_ids()) or is_salestrack_admin());
