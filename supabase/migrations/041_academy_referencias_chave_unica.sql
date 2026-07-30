-- 041 · Corrige a identidade natural de academy_referencias.
--
-- A 040 criou um índice único PARCIAL em (tipo, chave) where chave is not null and deleted_at is null.
-- O PostgREST não consegue usá-lo em upsert: ele envia ON CONFLICT (tipo, chave) sem o predicado,
-- e o Postgres recusa com "no unique or exclusion constraint matching the ON CONFLICT specification".
-- Verificado ao rodar a importação das 87 referências.
--
-- Restrição única simples resolve, e tem um efeito desejável: reimportar uma referência que foi
-- excluída (soft delete) a restaura, em vez de criar duplicata.

alter table academy_referencias alter column chave set not null;
drop index if exists ux_aref_chave;
alter table academy_referencias drop constraint if exists uq_aref_chave;
alter table academy_referencias add constraint uq_aref_chave unique (tipo, chave);
