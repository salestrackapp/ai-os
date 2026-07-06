-- R2.1 · Convenção de soft delete (base do "controle total").
-- Recurso de referência: signal_definitions. Próximos recursos (R2.2/R2.3) adotam o mesmo padrão:
--   1) add column deleted_at timestamptz;
--   2) index parcial ... where deleted_at is null;
--   3) listagens filtram .is('deleted_at', null) — RLS por org continua a mesma.
alter table signal_definitions add column if not exists deleted_at timestamptz;
create index if not exists idx_signal_definitions_alive on signal_definitions (deleted_at) where deleted_at is null;
