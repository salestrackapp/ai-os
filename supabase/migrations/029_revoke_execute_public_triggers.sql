-- 029 · Completa a revogação iniciada na 028.
--
-- A 028 revogou EXECUTE de anon e authenticated, mas não teve efeito: no Postgres toda função
-- nasce com GRANT EXECUTE TO PUBLIC, e revogar de um papel específico não remove a concessão
-- herdada de PUBLIC. Verificado após a 028: has_function_privilege('anon', ...) continuava true.
-- A revogação precisa ser de PUBLIC.
--
-- Só funções de gatilho. Elas nunca são chamadas por policy nem pela aplicação — disparam via
-- trigger, e o Postgres verifica EXECUTE na criação do trigger, não a cada disparo.

revoke execute on function public.fn_audit_hash()                from public;
revoke execute on function public.fn_touch_deal_activity()       from public;
revoke execute on function public.fn_lock_approved()             from public;
revoke execute on function public.fn_lock_approved_deliverable() from public;
revoke execute on function public.fn_lock_approved_identidade()  from public;
