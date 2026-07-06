-- R2.2 · Soft delete no agregado Programa + passo do ciclo.
alter table projects add column if not exists deleted_at timestamptz;
alter table projects add column if not exists cycle_step int;   -- 0..4 do AI Operating Method; null = derivar do progresso
alter table deliverables add column if not exists deleted_at timestamptz;
create index if not exists idx_projects_alive on projects (deleted_at) where deleted_at is null;
create index if not exists idx_deliverables_alive on deliverables (deleted_at) where deleted_at is null;
-- Cascata lógica (pai→filhos) e ocultação de excluídos são feitas na aplicação; RLS por org inalterada.
