-- R2.3 · Soft delete em lote nas entidades full-crud (contrato do kit R2.1: restore/undo).
-- Adicionar a coluna é seguro e reversível; listagens filtram deleted_at nas telas que adotam o kit.
alter table catalog_items     add column if not exists deleted_at timestamptz;
alter table session_catalog    add column if not exists deleted_at timestamptz;
alter table cadences           add column if not exists deleted_at timestamptz;
alter table template_verticals add column if not exists deleted_at timestamptz;
alter table template_blocks    add column if not exists deleted_at timestamptz;
alter table playbook_recipes   add column if not exists deleted_at timestamptz;
alter table playbook_trilhas   add column if not exists deleted_at timestamptz;
create index if not exists idx_catalog_items_alive on catalog_items (deleted_at) where deleted_at is null;
