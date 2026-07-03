-- AI OS · Migration 008 · Fase 4a: Portal do Cliente
-- (numerada 008 porque 004–007 já foram usadas nas fases anteriores)
-- Papéis de cliente adicionados em migração própria: alter type membership_role add value 'client_admin','client_member'
-- Políticas de LEITURA do cliente (organizations/projects/deliverables/library_assets/session_credits/
-- sessions/invoices/subscriptions/tenant_branding/playbook_recipes/memberships) JÁ EXISTEM desde a migração 000
-- (tenant_read_*). Nada a recriar aqui.

-- Convites de equipe do cliente
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'client_member',   -- client_admin | client_member
  token text unique not null default encode(gen_random_bytes(24),'hex'),
  invited_by uuid,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table invites enable row level security;
create policy admin_all_invites on invites
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy client_admin_own_invites on invites
  for all to authenticated
  using (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m where m.user_id = auth.uid() and m.org_id = invites.org_id and m.role::text = 'client_admin'))
  with check (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m where m.user_id = auth.uid() and m.org_id = invites.org_id and m.role::text = 'client_admin'));

-- Ativação do programa
alter table projects add column if not exists activated_at timestamptz;
alter table projects add column if not exists activated_by text;   -- 'primeiro_acesso' | 'admin'

-- Log leve de acesso ao portal (admin-only)
create table if not exists portal_access_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid,
  created_at timestamptz not null default now()
);
alter table portal_access_log enable row level security;
create policy admin_all_portal_access_log on portal_access_log
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create index if not exists idx_portal_access_org on portal_access_log(org_id, created_at desc);

-- Storage bucket da biblioteca (privado; URLs assinadas)
insert into storage.buckets (id, name, public) values ('biblioteca', 'biblioteca', false)
on conflict (id) do nothing;
