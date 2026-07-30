-- U1 · Jornada de Transformação — a fundação
-- 1) jornada pode começar sem contrato (prospect também tem jornada)
alter table projects alter column contract_id drop not null;

-- 2) estado por etapa (1..6) de cada jornada (= project)
create table if not exists journey_step_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  etapa int not null check (etapa between 1 and 6),
  status text not null default 'pendente' check (status in ('pendente','fazendo','concluido')),
  next_action text,
  owner uuid,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_id, etapa)
);
create index if not exists ix_journey_step_project on journey_step_state(project_id);

alter table journey_step_state enable row level security;
drop policy if exists journey_step_team on journey_step_state;
create policy journey_step_team on journey_step_state for all using (is_salestrack_admin()) with check (is_salestrack_admin());
