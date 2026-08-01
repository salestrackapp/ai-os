-- 068 · Fechar o RPC das funções SECURITY DEFINER
--
-- ── O que o advisor achou, e o que a Fase 0 achou que tinha resolvido ────────────────────────
-- A Fase 0 registrou "revogar execute de anon" em is_salestrack_admin, user_org_ids, fn_audit_hash
-- e rls_auto_enable. Metade ficou: fn_audit_hash e as fn_lgpd_* estão fechadas, as outras não. O
-- motivo é conhecido e já custou três tentativas neste projeto — o Supabase concede EXECUTE a
-- `anon` e `authenticated` EXPLICITAMENTE por `alter default privileges`, então `revoke from
-- public` não tira nada. Tem de revogar dos três nomes, um a um.
--
-- ── Por que NÃO revogar tudo de todo mundo ───────────────────────────────────────────────────
-- Expressão de policy roda com os privilégios de quem consulta. `is_salestrack_admin()` aparece em
-- 397 políticas e `user_org_ids()` em 51: tirar o EXECUTE de `authenticated` faria toda consulta
-- do sistema falhar por permissão. Estas continuam abertas para quem tem sessão — e isso não vaza
-- nada, porque as duas respondem sobre QUEM CHAMA: um cliente perguntando se é admin ouve "não".
--
-- O que se fecha aqui é o que ninguém precisa chamar.

-- 1) Puro utilitário de manutenção: nunca foi feito para ser chamado por HTTP.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) Funções de GATILHO (0 políticas, 1 trigger cada). O gatilho dispara por dentro do banco e não
--    depende de grant; expostas no RPC, só serviriam para alguém tentar rodá-las fora de contexto.
revoke execute on function public.fn_academy_attempt_guard() from public, anon, authenticated;
revoke execute on function public.fn_academy_matricula_liberada() from public, anon, authenticated;

-- 3) As três que a RLS usa: fecham para ANÔNIMO, seguem abertas para quem tem sessão.
--    Nenhuma política aplicada a `anon` as chama — as públicas (site_leads, andrekachan_leads,
--    newsletter_inscricoes) usam `with check (true)`, sem função.
revoke execute on function public.is_salestrack_admin() from public, anon;
revoke execute on function public.user_org_ids() from public, anon;
revoke execute on function public.academy_manager_org_ids() from public, anon;

-- 4) O padrão para o futuro: função nova não nasce mais aberta a anônimo.
--    Sem isto, a próxima migration reabre tudo sem ninguém perceber — foi exatamente assim que as
--    revogações da Fase 0 se perderam.
alter default privileges in schema public revoke execute on functions from anon;

comment on function public.rls_auto_enable() is
  'Utilitário de manutenção. EXECUTE revogado de anon/authenticated: não é para ser chamado por HTTP.';

/*
 * As duas que FICAM abertas a anônimo, de propósito:
 *   site_leads_recentes_por_ip / ak_leads_recentes_por_ip — o limite de taxa dos formulários
 *   públicos. Devolvem um NÚMERO (quantos envios daquele hash de IP na janela), nunca uma linha,
 *   e existem justamente para a chave anônima não precisar de leitura na tabela de leads.
 */
