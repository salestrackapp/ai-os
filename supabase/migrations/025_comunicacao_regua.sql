-- R4.1 · Régua de comunicação (DEFINIÇÃO, não execução). Aditivo/reversível.
create table if not exists regua (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),          -- null quando scope=program_template (global Salestrack)
  scope text not null default 'program',             -- 'program_template' | 'program'
  ref_id uuid,                                       -- template de programa (Fase 9) ou projects.id
  nome text not null,
  ativo boolean not null default true,
  version int not null default 1,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regua_scope_check check (scope in ('program_template','program'))
);
create index if not exists idx_regua_alive on regua (deleted_at) where deleted_at is null;
create index if not exists idx_regua_ref on regua (scope, ref_id);
create index if not exists idx_regua_org on regua (org_id);

create table if not exists regua_step (
  id uuid primary key default gen_random_uuid(),
  regua_id uuid not null references regua(id),
  cycle_step int not null default 0,                 -- 0..4 do AI Operating Method
  titulo text not null,
  gatilho jsonb not null default '{}'::jsonb,         -- {tipo:tempo|evento|estado, ...} validado na app
  asset_type text not null,                          -- tipo de ativo do Estúdio (email/whatsapp/post/relatorio/...)
  asset_ref uuid references studio_deliverables(id), -- ativo específico aprovado (quando escolhido)
  timing jsonb not null default '{}'::jsonb,          -- {quando, offset_dias}
  publico text not null default 'cliente',           -- cliente | equipe_cliente | admin
  ordem int not null default 0,
  ativo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_regua_step_regua on regua_step (regua_id);
create index if not exists idx_regua_step_alive on regua_step (deleted_at) where deleted_at is null;

alter table regua enable row level security;
alter table regua_step enable row level security;
drop policy if exists regua_admin on regua;
create policy regua_admin on regua for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists regua_client_read on regua;
create policy regua_client_read on regua for select using (org_id in (select user_org_ids()));
drop policy if exists regua_step_admin on regua_step;
create policy regua_step_admin on regua_step for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists regua_step_client_read on regua_step;
create policy regua_step_client_read on regua_step for select using (
  regua_id in (select id from regua where org_id in (select user_org_ids()))
);
