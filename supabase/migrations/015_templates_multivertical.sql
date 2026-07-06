-- AI OS · Migration 015 · Fase 9: Biblioteca de templates multi-vertical (renumerada de 012 → 015)
-- Camada de AUTORIA (admin Salestrack). Compila para a MESMA `structure` jsonb que a Fase 8 consome.
-- ESTENDE program_templates (Fase 8); não recria. Contrato de saída inalterado.

create table if not exists template_verticals (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, name text not null, description text,
  tone text, default_agents jsonb not null default '{}', is_active boolean not null default true
);

create table if not exists template_blocks (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, name text not null,
  category text not null,                    -- frente|entregavel|agente|kpi|marco|biblioteca
  vertical_key text,                         -- null = genérico
  content jsonb not null default '{}', is_active boolean not null default true
);

create table if not exists template_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,                -- → program_templates.key
  version int not null,
  structure jsonb not null default '{}',     -- compilada, formato da Fase 8
  composed_from jsonb not null default '[]', -- lista de template_blocks.key
  changelog text, is_published boolean not null default false,
  published_at timestamptz, created_by uuid, created_at timestamptz not null default now(),
  unique (template_key, version)
);

-- estende program_templates (Fase 8)
alter table program_templates add column if not exists vertical_key text;
alter table program_templates add column if not exists current_version int;

alter table template_verticals enable row level security;
alter table template_blocks    enable row level security;
alter table template_versions  enable row level security;

create policy tv_admin  on template_verticals for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy tb_admin2 on template_blocks    for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy tver_admin on template_versions for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
