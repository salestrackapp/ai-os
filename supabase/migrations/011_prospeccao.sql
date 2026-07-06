-- AI OS · Migration 011 · Fase 5.5: Espinha comercial (CRM de prospecção + cadências + timeline)
-- (renumerada de 008 no prompt → 011; a tabela "activities" do prompt vira `timeline_events`
--  para NÃO colidir com a `activities` da Fase 1, já usada no dashboard/WhatsApp.)
-- TODOS estes dados são internos da Salestrack (pré-venda). RLS: só admin/operador Salestrack.

create table if not exists prospect_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null, domain text, size text, industry text,
  icp text, signals jsonb not null default '[]', score int not null default 0,
  apollo_id text, source text, owner uuid, created_at timestamptz not null default now()
);

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references prospect_accounts(id) on delete set null,
  name text not null, title text, seniority text, icp text,
  email text, phone text, linkedin_url text, apollo_id text,
  score int not null default 0,
  status text not null default 'novo',      -- novo|qualificado|em_cadencia|respondeu|reuniao|descartado|virou_deal
  dossier_md text, source text not null default 'manual', -- apollo|ramper|indicacao|manual
  deal_id uuid references deals(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_prospects_status on prospects(status);
create index if not exists idx_prospects_account on prospects(account_id);

create table if not exists cadences (
  id uuid primary key default gen_random_uuid(),
  name text not null, icp text, steps jsonb not null default '[]', is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cadence_enrollments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  cadence_id uuid not null references cadences(id) on delete cascade,
  current_step int not null default 0,
  status text not null default 'ativa',      -- ativa|pausada|concluida|respondida|saiu
  next_action_at timestamptz, enrolled_at timestamptz not null default now()
);
create index if not exists idx_enroll_next on cadence_enrollments(status, next_action_at);

create table if not exists cadence_step_log (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references cadence_enrollments(id) on delete cascade,
  step_no int not null, channel text, action text,
  status text not null default 'agendado',   -- agendado|enviado|tarefa_manual|pulado
  message_id uuid, executed_at timestamptz
);

create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  channel text not null default 'email', subject text, body text,
  variant text, agent_generated boolean not null default false,
  status text not null default 'rascunho',   -- rascunho|aprovada|enviada|reprovada
  approved_by uuid, sent_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_outreach_status on outreach_messages(status);

-- Timeline unificada (por prospect | deal | org) — fontes Salestrack
create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,                -- prospect|deal|org
  subject_id uuid not null,
  source text not null,                      -- gmail|calendar|readai|cadence|manual
  kind text not null,                        -- email|reuniao|nota|toque|resposta
  summary text, occurred_at timestamptz not null default now(),
  external_ref text, created_at timestamptz not null default now()
);
create index if not exists idx_timeline_subject on timeline_events(subject_type, subject_id, occurred_at desc);

alter table prospect_accounts   enable row level security;
alter table prospects           enable row level security;
alter table cadences            enable row level security;
alter table cadence_enrollments enable row level security;
alter table cadence_step_log    enable row level security;
alter table outreach_messages   enable row level security;
alter table timeline_events     enable row level security;

-- RLS: prospecção é 100% interna da Salestrack — só admin. Nenhuma org-cliente enxerga.
create policy prospaccounts_admin on prospect_accounts   for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy prospects_admin     on prospects           for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy cadences_admin      on cadences            for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy enroll_admin        on cadence_enrollments for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy steplog_admin       on cadence_step_log    for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy outreach_admin      on outreach_messages   for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy timeline_admin      on timeline_events     for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
