-- AI OS · Migration 005 · Corrige fn_lock_approved (bug latente da 000)
-- (1) Comparar old.status (enum proposal_status) com o literal 'assinado' (contract_status)
--     fazia o Postgres coagir 'assinado' para proposal_status e falhar em TODO update de
--     proposals ("invalid input value for enum proposal_status: assinado"). Usar ::text resolve.
-- (2) DELETE retornava NEW (null) -> cancelava silenciosamente todos os deletes. Corrigido p/ OLD.
create or replace function fn_lock_approved() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'proposals' and old.status::text = 'aprovada' then
    raise exception 'Proposta aprovada é imutável (AI OS)';
  end if;
  if tg_table_name = 'contracts' and old.status::text = 'assinado' then
    raise exception 'Contrato assinado é imutável (AI OS)';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
