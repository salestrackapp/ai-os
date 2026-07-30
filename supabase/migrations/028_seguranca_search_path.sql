-- 028 · Segurança: search_path fixo nas funções SECURITY DEFINER + revogação de EXECUTE nos gatilhos
-- Aditivo e reversível: nenhum DROP, nenhum corpo de função reescrito (só ALTER FUNCTION ... SET).
--
-- Motivo: os 7 SECURITY DEFINER abaixo rodavam com search_path mutável. Numa função SECURITY DEFINER
-- isso é vetor de escalonamento: quem conseguisse criar um objeto num schema à frente do search_path
-- sequestraria a resolução de nomes — inclusive de is_salestrack_admin(), que decide quem é admin.
--
-- public, pg_temp é seguro aqui porque nenhum papel tem CREATE no schema public
-- (verificado: has_schema_privilege para anon, authenticated e PUBLIC = false).

alter function public.is_salestrack_admin()          set search_path = public, pg_temp;
alter function public.user_org_ids()                 set search_path = public, pg_temp;
alter function public.fn_audit_hash()                set search_path = public, pg_temp;
alter function public.fn_lock_approved()             set search_path = public, pg_temp;
alter function public.fn_touch_deal_activity()       set search_path = public, pg_temp;
alter function public.fn_lock_approved_deliverable() set search_path = public, pg_temp;
alter function public.fn_lock_approved_identidade()  set search_path = public, pg_temp;

-- Funções de gatilho não são chamadas por policy nem por código da aplicação: só disparam via trigger,
-- e o Postgres verifica EXECUTE na CRIAÇÃO do trigger, não a cada disparo. Revogar é seguro e tira
-- essas funções de /rest/v1/rpc/.
revoke execute on function public.fn_audit_hash()                from anon, authenticated;
revoke execute on function public.fn_lock_approved()             from anon, authenticated;
revoke execute on function public.fn_touch_deal_activity()       from anon, authenticated;
revoke execute on function public.fn_lock_approved_deliverable() from anon, authenticated;
revoke execute on function public.fn_lock_approved_identidade()  from anon, authenticated;

-- NÃO revogamos EXECUTE de is_salestrack_admin() e user_org_ids(), apesar do aviso do linter:
-- 20 policies se aplicam a PUBLIC (foram criadas sem "to authenticated") e chamam essas funções.
-- Como a expressão da policy é avaliada com os privilégios de quem consulta, revogar transformaria
-- "0 linhas" em "permission denied for function" para o papel anon. A exposição real é nula: ambas
-- são escopadas por auth.uid(), então para um chamador não autenticado retornam false / conjunto vazio.
