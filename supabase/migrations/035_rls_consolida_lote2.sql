-- 035 · Consolidação de policies duplicadas — lote 2 (11 tabelas padrão + audit_logs)
-- Mesma transformação da 034. Condições e papéis lidos de pg_policies antes da reescrita.

-- claude_workspaces
drop policy if exists admin_all_claude_workspaces on claude_workspaces;
drop policy if exists tenant_read_claude_workspaces on claude_workspaces;
create policy claude_workspaces_select on claude_workspaces for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy claude_workspaces_ins on claude_workspaces for insert to authenticated with check (is_salestrack_admin());
create policy claude_workspaces_upd on claude_workspaces for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy claude_workspaces_del on claude_workspaces for delete to authenticated using (is_salestrack_admin());

-- custom_domains
drop policy if exists admin_all_custom_domains on custom_domains;
drop policy if exists tenant_read_custom_domains on custom_domains;
create policy custom_domains_select on custom_domains for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy custom_domains_ins on custom_domains for insert to authenticated with check (is_salestrack_admin());
create policy custom_domains_upd on custom_domains for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy custom_domains_del on custom_domains for delete to authenticated using (is_salestrack_admin());

-- memberships
drop policy if exists admin_all_memberships on memberships;
drop policy if exists tenant_read_memberships on memberships;
create policy memberships_select on memberships for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy memberships_ins on memberships for insert to authenticated with check (is_salestrack_admin());
create policy memberships_upd on memberships for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy memberships_del on memberships for delete to authenticated using (is_salestrack_admin());

-- orchestrations
drop policy if exists admin_all_orchestrations on orchestrations;
drop policy if exists tenant_read_orchestrations on orchestrations;
create policy orchestrations_select on orchestrations for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy orchestrations_ins on orchestrations for insert to authenticated with check (is_salestrack_admin());
create policy orchestrations_upd on orchestrations for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy orchestrations_del on orchestrations for delete to authenticated using (is_salestrack_admin());

-- proposals
drop policy if exists admin_all_proposals on proposals;
drop policy if exists tenant_read_proposals on proposals;
create policy proposals_select on proposals for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy proposals_ins on proposals for insert to authenticated with check (is_salestrack_admin());
create policy proposals_upd on proposals for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy proposals_del on proposals for delete to authenticated using (is_salestrack_admin());

-- session_credits
drop policy if exists admin_all_session_credits on session_credits;
drop policy if exists tenant_read_session_credits on session_credits;
create policy session_credits_select on session_credits for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy session_credits_ins on session_credits for insert to authenticated with check (is_salestrack_admin());
create policy session_credits_upd on session_credits for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy session_credits_del on session_credits for delete to authenticated using (is_salestrack_admin());

-- sessions
drop policy if exists admin_all_sessions on sessions;
drop policy if exists tenant_read_sessions on sessions;
create policy sessions_select on sessions for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy sessions_ins on sessions for insert to authenticated with check (is_salestrack_admin());
create policy sessions_upd on sessions for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy sessions_del on sessions for delete to authenticated using (is_salestrack_admin());

-- skill_deployments
drop policy if exists admin_all_skill_deployments on skill_deployments;
drop policy if exists tenant_read_skill_deployments on skill_deployments;
create policy skill_deployments_select on skill_deployments for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy skill_deployments_ins on skill_deployments for insert to authenticated with check (is_salestrack_admin());
create policy skill_deployments_upd on skill_deployments for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy skill_deployments_del on skill_deployments for delete to authenticated using (is_salestrack_admin());

-- subscriptions
drop policy if exists admin_all_subscriptions on subscriptions;
drop policy if exists tenant_read_subscriptions on subscriptions;
create policy subscriptions_select on subscriptions for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy subscriptions_ins on subscriptions for insert to authenticated with check (is_salestrack_admin());
create policy subscriptions_upd on subscriptions for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy subscriptions_del on subscriptions for delete to authenticated using (is_salestrack_admin());

-- tasks
drop policy if exists admin_all_tasks on tasks;
drop policy if exists tenant_read_tasks on tasks;
create policy tasks_select on tasks for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy tasks_ins on tasks for insert to authenticated with check (is_salestrack_admin());
create policy tasks_upd on tasks for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy tasks_del on tasks for delete to authenticated using (is_salestrack_admin());

-- tenant_branding
drop policy if exists admin_all_tenant_branding on tenant_branding;
drop policy if exists tenant_read_tenant_branding on tenant_branding;
create policy tenant_branding_select on tenant_branding for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy tenant_branding_ins on tenant_branding for insert to authenticated with check (is_salestrack_admin());
create policy tenant_branding_upd on tenant_branding for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy tenant_branding_del on tenant_branding for delete to authenticated using (is_salestrack_admin());

-- audit_logs: SEM policy de update/delete, de propósito.
-- A trilha é imutável por desenho (a 000 já faz `revoke update, delete ... from authenticated, anon`).
-- Declarar só select e insert deixa a intenção explícita no lugar de depender apenas do grant.
drop policy if exists admin_all_audit_logs on audit_logs;
drop policy if exists tenant_read_audit on audit_logs;
create policy audit_logs_select on audit_logs for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy audit_logs_ins on audit_logs for insert to authenticated with check (is_salestrack_admin());
