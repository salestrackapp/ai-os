-- Formulário público de diagnóstico (o cliente preenche via link com token). Gerido pela equipe Salestrack.
create table if not exists diagnostico_intake (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  token text not null unique,
  titulo text not null default 'Diagnóstico Digital',
  status text not null default 'aberto' check (status in ('aberto','enviado')),
  dados jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_diagnostico_org on diagnostico_intake(org_id);

alter table diagnostico_intake enable row level security;
drop policy if exists diag_team on diagnostico_intake;
create policy diag_team on diagnostico_intake for all using (is_salestrack_admin()) with check (is_salestrack_admin());
-- acesso público é só via service client (token é o segredo), sem policy anônima.
