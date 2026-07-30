-- 031 · Performance de RLS: auth.uid() avaliado uma vez por consulta, não uma vez por linha
--
-- Chamada solta, auth.uid() é reavaliada para CADA linha examinada pela policy. Envolvida em
-- subconsulta — (select auth.uid()) — o planejador a transforma em InitPlan e avalia uma única vez.
-- Em tabelas que crescem, essa é a diferença entre custo linear e custo constante nesse trecho.
--
-- A lógica das 5 policies é preservada byte a byte no restante: nada muda em quem enxerga o quê.
-- As definições abaixo foram extraídas de pg_policies antes da reescrita.

drop policy if exists tenant_accept_policy on ai_policy_acceptances;
create policy tenant_accept_policy on ai_policy_acceptances
  for insert to authenticated
  with check (org_id in (select user_org_ids()) and user_id = (select auth.uid()));

drop policy if exists client_admin_own_invites on invites;
create policy client_admin_own_invites on invites
  for all to authenticated
  using (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin'))
  with check (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin'));

drop policy if exists op_own on onboarding_progress;
create policy op_own on onboarding_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and org_id in (select user_org_ids()));

drop policy if exists rel_notif_team on rel_notificacoes;
create policy rel_notif_team on rel_notificacoes
  for all to authenticated
  using (is_salestrack_admin() and (user_id = (select auth.uid()) or user_id is null))
  with check (is_salestrack_admin());

drop policy if exists rel_rasc_own on rel_rascunhos;
create policy rel_rasc_own on rel_rascunhos
  for all to authenticated
  using (is_salestrack_admin() and user_id = (select auth.uid()))
  with check (is_salestrack_admin() and user_id = (select auth.uid()));
