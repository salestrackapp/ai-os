-- AI OS · Migration 007 · Configurações da aplicação (termos de contrato etc.)

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy admin_all_app_settings on app_settings
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
