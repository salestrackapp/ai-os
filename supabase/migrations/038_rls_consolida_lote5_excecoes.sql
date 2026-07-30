-- 038 · Consolidação de policies duplicadas — lote 5 (as 4 exceções)
--
-- Estas quatro não seguiam o par admin_all + tenant_read, cada uma por um motivo diferente.

-- governance_policies: gov_read era INTEIRAMENTE redundante — gov_write já era FOR ALL com a
-- mesma condição, então cobria o select. O tenant escreve aqui de propósito (gere as próprias
-- políticas de governança), e isso é preservado.
drop policy if exists gov_read on governance_policies;
drop policy if exists gov_write on governance_policies;
create policy governance_policies_select on governance_policies for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy governance_policies_ins on governance_policies for insert to authenticated
  with check (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy governance_policies_upd on governance_policies for update to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()))
  with check (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy governance_policies_del on governance_policies for delete to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));

-- invites: eram DUAS policies FOR ALL (admin + client_admin), duplicando em todos os comandos.
-- A exigência de papel client_admin para escrever — introduzida pela migration 008b — continua
-- valendo em insert, update e delete.
drop policy if exists admin_all_invites on invites;
drop policy if exists client_admin_own_invites on invites;
create policy invites_select on invites for select to authenticated
  using (is_salestrack_admin() or (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin')));
create policy invites_ins on invites for insert to authenticated
  with check (is_salestrack_admin() or (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin')));
create policy invites_upd on invites for update to authenticated
  using (is_salestrack_admin() or (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin')))
  with check (is_salestrack_admin() or (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin')));
create policy invites_del on invites for delete to authenticated
  using (is_salestrack_admin() or (org_id in (select user_org_ids()) and exists (
    select 1 from memberships m
    where m.user_id = (select auth.uid()) and m.org_id = invites.org_id and m.role::text = 'client_admin')));

-- library_assets: tinha DUAS policies de select — a da própria org e a dos ativos mestres
-- (org_id is null, biblioteca global). As duas viram uma condição só.
drop policy if exists admin_all_library_assets on library_assets;
drop policy if exists tenant_read_library_assets on library_assets;
drop policy if exists tenant_read_master_assets on library_assets;
create policy library_assets_select on library_assets for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()) or org_id is null);
create policy library_assets_ins on library_assets for insert to authenticated with check (is_salestrack_admin());
create policy library_assets_upd on library_assets for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy library_assets_del on library_assets for delete to authenticated using (is_salestrack_admin());

-- ai_policy_acceptances: tinha uma policy de INSERT própria do tenant (o usuário registra o
-- aceite dele). Ela some como policy separada, mas a permissão vira parte do insert consolidado —
-- inclusive a exigência de que o aceite seja do próprio usuário.
drop policy if exists admin_all_ai_policy_acceptances on ai_policy_acceptances;
drop policy if exists tenant_accept_policy on ai_policy_acceptances;
drop policy if exists tenant_read_acceptances on ai_policy_acceptances;
create policy ai_policy_acceptances_select on ai_policy_acceptances for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy ai_policy_acceptances_ins on ai_policy_acceptances for insert to authenticated
  with check (is_salestrack_admin() or (org_id in (select user_org_ids()) and user_id = (select auth.uid())));
create policy ai_policy_acceptances_upd on ai_policy_acceptances for update to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy ai_policy_acceptances_del on ai_policy_acceptances for delete to authenticated
  using (is_salestrack_admin());
