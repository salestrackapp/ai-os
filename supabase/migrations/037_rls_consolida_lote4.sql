-- 037 · Consolidação de policies duplicadas — lote 4 (catálogos globais e condições especiais)
--
-- Aqui as condições de leitura NÃO são o padrão org_id. Cada uma foi lida de pg_policies e
-- preservada: catálogo global (true), publicação (published), status do entregável, e
-- organizations, que casa em id e não em org_id.

-- Catálogos globais: leitura livre para autenticados, escrita só do admin.
drop policy if exists admin_all_ai_platforms on ai_platforms;
drop policy if exists read_ai_platforms on ai_platforms;
create policy ai_platforms_select on ai_platforms for select to authenticated using (true);
create policy ai_platforms_ins on ai_platforms for insert to authenticated with check (is_salestrack_admin());
create policy ai_platforms_upd on ai_platforms for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy ai_platforms_del on ai_platforms for delete to authenticated using (is_salestrack_admin());

drop policy if exists plans_admin on plans;
drop policy if exists plans_read on plans;
create policy plans_select on plans for select to authenticated using (true);
create policy plans_ins on plans for insert to authenticated with check (is_salestrack_admin());
create policy plans_upd on plans for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy plans_del on plans for delete to authenticated using (is_salestrack_admin());

drop policy if exists admin_all_platform_benchmarks on platform_benchmarks;
drop policy if exists read_benchmarks on platform_benchmarks;
create policy platform_benchmarks_select on platform_benchmarks for select to authenticated using (true);
create policy platform_benchmarks_ins on platform_benchmarks for insert to authenticated with check (is_salestrack_admin());
create policy platform_benchmarks_upd on platform_benchmarks for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy platform_benchmarks_del on platform_benchmarks for delete to authenticated using (is_salestrack_admin());

drop policy if exists admin_all_playbook_use_cases on playbook_use_cases;
drop policy if exists read_use_cases on playbook_use_cases;
create policy playbook_use_cases_select on playbook_use_cases for select to authenticated using (true);
create policy playbook_use_cases_ins on playbook_use_cases for insert to authenticated with check (is_salestrack_admin());
create policy playbook_use_cases_upd on playbook_use_cases for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy playbook_use_cases_del on playbook_use_cases for delete to authenticated using (is_salestrack_admin());

drop policy if exists admin_all_trilhas on trilhas;
drop policy if exists read_trilhas on trilhas;
create policy trilhas_select on trilhas for select to authenticated using (true);
create policy trilhas_ins on trilhas for insert to authenticated with check (is_salestrack_admin());
create policy trilhas_upd on trilhas for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy trilhas_del on trilhas for delete to authenticated using (is_salestrack_admin());

-- Conteúdo publicado: rascunho só o admin enxerga.
drop policy if exists admin_recipes on playbook_recipes;
drop policy if exists read_recipes on playbook_recipes;
create policy playbook_recipes_select on playbook_recipes for select to authenticated
  using (published or is_salestrack_admin());
create policy playbook_recipes_ins on playbook_recipes for insert to authenticated with check (is_salestrack_admin());
create policy playbook_recipes_upd on playbook_recipes for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy playbook_recipes_del on playbook_recipes for delete to authenticated using (is_salestrack_admin());

drop policy if exists admin_trilhas on playbook_trilhas;
drop policy if exists read_trilhas on playbook_trilhas;
create policy playbook_trilhas_select on playbook_trilhas for select to authenticated
  using (published or is_salestrack_admin());
create policy playbook_trilhas_ins on playbook_trilhas for insert to authenticated with check (is_salestrack_admin());
create policy playbook_trilhas_upd on playbook_trilhas for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy playbook_trilhas_del on playbook_trilhas for delete to authenticated using (is_salestrack_admin());

drop policy if exists admin_catalog on session_catalog;
drop policy if exists read_catalog on session_catalog;
create policy session_catalog_select on session_catalog for select to authenticated
  using (published or is_salestrack_admin());
create policy session_catalog_ins on session_catalog for insert to authenticated with check (is_salestrack_admin());
create policy session_catalog_upd on session_catalog for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy session_catalog_del on session_catalog for delete to authenticated using (is_salestrack_admin());

-- organizations: o cliente enxerga a própria org casando em id, não em org_id.
drop policy if exists admin_all_organizations on organizations;
drop policy if exists tenant_read_own_org on organizations;
create policy organizations_select on organizations for select to authenticated
  using (is_salestrack_admin() or id in (select user_org_ids()));
create policy organizations_ins on organizations for insert to authenticated with check (is_salestrack_admin());
create policy organizations_upd on organizations for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy organizations_del on organizations for delete to authenticated using (is_salestrack_admin());

-- studio_deliverables: o cliente só vê o que já foi aprovado ou entregue (portão do Estúdio).
drop policy if exists sd_admin on studio_deliverables;
drop policy if exists sd_client_read on studio_deliverables;
create policy studio_deliverables_select on studio_deliverables for select to authenticated
  using (is_salestrack_admin() or (org_id in (select user_org_ids()) and status in ('aprovado','entregue')));
create policy studio_deliverables_ins on studio_deliverables for insert to authenticated with check (is_salestrack_admin());
create policy studio_deliverables_upd on studio_deliverables for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy studio_deliverables_del on studio_deliverables for delete to authenticated using (is_salestrack_admin());

-- roi_reports: o cliente só vê o relatório publicado da própria org.
drop policy if exists roi_admin on roi_reports;
drop policy if exists roi_read on roi_reports;
create policy roi_reports_select on roi_reports for select to authenticated
  using (is_salestrack_admin() or (publicado and org_id in (select user_org_ids())));
create policy roi_reports_ins on roi_reports for insert to authenticated with check (is_salestrack_admin());
create policy roi_reports_upd on roi_reports for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy roi_reports_del on roi_reports for delete to authenticated using (is_salestrack_admin());
