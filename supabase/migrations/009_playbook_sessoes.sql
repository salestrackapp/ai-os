-- AI OS · Migration 009 · Fase 4b: Playbook + Sessões ao Vivo
-- RECONCILIAÇÃO com o schema da Fase 1 (migração 000):
--   • session_credits e sessions JÁ EXISTEM e são usadas pelo kickoff (F3) — mantidas.
--     session_credits: schema existente (type/total/consumed/valid_until) preservado; código F4b adaptado.
--     sessions: reaproveita colunas existentes (status/scheduled_at/meet_link/summary_md/recording_url/attendees);
--               só adiciona catalog_id.
--   • playbook_recipes e recipe_progress existiam vazias com schema incompatível → recriadas no schema F4b.

-- Trilhas do Playbook
create table if not exists playbook_trilhas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  perfil text not null,
  descricao text,
  ordem int not null default 0,
  published boolean not null default true
);

-- Recriar receitas e progresso (tabelas antigas vazias, schema incompatível)
drop table if exists recipe_progress cascade;
drop table if exists playbook_recipes cascade;

create table playbook_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  frente text,
  perfil text not null,
  nivel text not null default 'iniciante',
  tempo_min int,
  oque text, porque text, ganho text,
  passos jsonb not null default '[]',
  prompt_pronto text,
  trilha_id uuid references playbook_trilhas(id),
  ordem int not null default 0,
  needs_review boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipe_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  recipe_id uuid not null references playbook_recipes(id) on delete cascade,
  status text not null default 'concluida',
  feedback text,
  completed_at timestamptz not null default now(),
  unique (org_id, user_id, recipe_id, status)
);

-- Catálogo de sessões (global)
create table if not exists session_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  marca text not null,
  modalidade text not null,
  duracao_min int,
  descricao text,
  calendly_url text,
  published boolean not null default true
);

-- sessions: só o que falta (demais colunas já existem da migração 000)
alter table sessions add column if not exists catalog_id uuid references session_catalog(id);

-- RLS
alter table playbook_trilhas enable row level security;
alter table playbook_recipes enable row level security;
alter table recipe_progress enable row level security;
alter table session_catalog enable row level security;

create policy read_trilhas  on playbook_trilhas for select to authenticated using (published or is_salestrack_admin());
create policy admin_trilhas on playbook_trilhas for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy read_recipes  on playbook_recipes for select to authenticated using (published or is_salestrack_admin());
create policy admin_recipes on playbook_recipes for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy read_catalog  on session_catalog for select to authenticated using (published or is_salestrack_admin());
create policy admin_catalog on session_catalog for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy prog_own on recipe_progress for all to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin())
  with check (org_id in (select user_org_ids()) or is_salestrack_admin());
-- sessions e session_credits mantêm as policies tenant_read_*/admin_all_* da migração 000.
