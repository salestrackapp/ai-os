alter table app_settings add column if not exists scope text not null default 'global';
alter table app_settings add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table app_settings add column if not exists category text;
alter table app_settings add column if not exists updated_by uuid;

create table if not exists integration_secrets (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  scope text not null default 'global',
  org_id uuid references organizations(id) on delete cascade,
  secret text,                                   -- server-only; nunca selecionado ao client
  status text not null default 'ausente',        -- configurado|ausente|invalido
  last_tested_at timestamptz, updated_by uuid, updated_at timestamptz not null default now()
);
alter table integration_secrets enable row level security;
create policy is_admin on integration_secrets for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
