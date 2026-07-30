-- UC · catálogo multiformato
alter table studio_deliverables add column if not exists catalog_family text;
alter table studio_deliverables add column if not exists external_url text;

-- módulos (passo a passo)
create table if not exists studio_modules (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references studio_deliverables(id) on delete cascade,
  ordem int not null default 1,
  titulo text not null,
  tipo text not null default 'texto',      -- texto|video|slide|tarefa|audio
  conteudo jsonb not null default '{}'::jsonb,
  url text,
  created_at timestamptz not null default now(),
  unique (deliverable_id, ordem)
);
create index if not exists ix_studio_modules_deliverable on studio_modules(deliverable_id);

-- progresso de consumo (por org do entregável, no público via token)
create table if not exists deliverable_progress (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references studio_deliverables(id) on delete cascade,
  subject_type text not null default 'org' check (subject_type in ('org','contact')),
  subject_id uuid not null,
  module_index int not null,
  done_at timestamptz not null default now(),
  unique (deliverable_id, subject_type, subject_id, module_index)
);
create index if not exists ix_deliverable_progress_del on deliverable_progress(deliverable_id);

alter table studio_modules enable row level security;
alter table deliverable_progress enable row level security;
drop policy if exists studio_modules_team on studio_modules;
create policy studio_modules_team on studio_modules for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists deliverable_progress_team on deliverable_progress;
create policy deliverable_progress_team on deliverable_progress for all using (is_salestrack_admin()) with check (is_salestrack_admin());

-- backfill family pelos kinds atuais (heurística; default executivo p/ docs)
update studio_deliverables set catalog_family = case
  when kind in ('curso','treinamento','trilha','workshop','playbook','ebook','mapa_mental','webinar','certificado') then 'aprendizagem'
  when kind in ('video','podcast','imagem','infografico','newsletter','roteiro') then 'midia'
  when kind in ('planilha','dashboard','calculadora','checklist','template') then 'documentos'
  when kind in ('aplicacao','agente_ia','automacao','site','prompts') then 'produtos'
  else 'executivo' end
where catalog_family is null;
