-- 034 · Consolidação de policies duplicadas — lote 1 de 5 (8 tabelas de padrão idêntico)
--
-- Problema: cada tabela tinha admin_all_X (FOR ALL) + tenant_read_X (FOR SELECT). Como policies
-- permissivas são combinadas por OR, TODA leitura avaliava as duas expressões. O linter aponta
-- 74 ocorrências disso em 42 tabelas.
--
-- Solução: uma policy por comando. O SELECT passa a ter uma expressão só, com o mesmo resultado
-- lógico (is_salestrack_admin() OR condição-de-tenant); escrita continua exclusiva do admin,
-- agora declarada em insert/update/delete separados para não reintroduzir duplicidade no select.
--
-- Semântica preservada byte a byte: a condição de leitura e os papéis (to authenticated) foram
-- lidos de pg_policies antes da reescrita. Nada muda em quem enxerga ou escreve o quê.

-- activities
drop policy if exists admin_all_activities on activities;
drop policy if exists tenant_read_activities on activities;
create policy activities_select on activities for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy activities_ins on activities for insert to authenticated with check (is_salestrack_admin());
create policy activities_upd on activities for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy activities_del on activities for delete to authenticated using (is_salestrack_admin());

-- agent_conversations
drop policy if exists admin_all_agent_conversations on agent_conversations;
drop policy if exists tenant_read_agent_conversations on agent_conversations;
create policy agent_conversations_select on agent_conversations for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy agent_conversations_ins on agent_conversations for insert to authenticated with check (is_salestrack_admin());
create policy agent_conversations_upd on agent_conversations for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy agent_conversations_del on agent_conversations for delete to authenticated using (is_salestrack_admin());

-- ai_policies
drop policy if exists admin_all_ai_policies on ai_policies;
drop policy if exists tenant_read_ai_policies on ai_policies;
create policy ai_policies_select on ai_policies for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy ai_policies_ins on ai_policies for insert to authenticated with check (is_salestrack_admin());
create policy ai_policies_upd on ai_policies for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy ai_policies_del on ai_policies for delete to authenticated using (is_salestrack_admin());

-- client_ai_stack
drop policy if exists admin_all_client_ai_stack on client_ai_stack;
drop policy if exists tenant_read_client_ai_stack on client_ai_stack;
create policy client_ai_stack_select on client_ai_stack for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy client_ai_stack_ins on client_ai_stack for insert to authenticated with check (is_salestrack_admin());
create policy client_ai_stack_upd on client_ai_stack for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy client_ai_stack_del on client_ai_stack for delete to authenticated using (is_salestrack_admin());

-- contracts
drop policy if exists admin_all_contracts on contracts;
drop policy if exists tenant_read_contracts on contracts;
create policy contracts_select on contracts for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy contracts_ins on contracts for insert to authenticated with check (is_salestrack_admin());
create policy contracts_upd on contracts for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy contracts_del on contracts for delete to authenticated using (is_salestrack_admin());

-- deliverables
drop policy if exists admin_all_deliverables on deliverables;
drop policy if exists tenant_read_deliverables on deliverables;
create policy deliverables_select on deliverables for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy deliverables_ins on deliverables for insert to authenticated with check (is_salestrack_admin());
create policy deliverables_upd on deliverables for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy deliverables_del on deliverables for delete to authenticated using (is_salestrack_admin());

-- invoices
drop policy if exists admin_all_invoices on invoices;
drop policy if exists tenant_read_invoices on invoices;
create policy invoices_select on invoices for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy invoices_ins on invoices for insert to authenticated with check (is_salestrack_admin());
create policy invoices_upd on invoices for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy invoices_del on invoices for delete to authenticated using (is_salestrack_admin());

-- projects
drop policy if exists admin_all_projects on projects;
drop policy if exists tenant_read_projects on projects;
create policy projects_select on projects for select to authenticated
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy projects_ins on projects for insert to authenticated with check (is_salestrack_admin());
create policy projects_upd on projects for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy projects_del on projects for delete to authenticated using (is_salestrack_admin());
