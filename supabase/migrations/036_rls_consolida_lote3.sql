-- 036 · Consolidação de policies duplicadas — lote 3 (7 tabelas cujas policies valem para PUBLIC)
--
-- Estas foram criadas sem cláusula TO, ou seja, valem para PUBLIC (inclui anon). O alcance é
-- preservado de propósito: restringir para authenticated mudaria o comportamento do papel anon
-- de "0 linhas" para "acesso negado" sem ganho de segurança — as condições já são escopadas por
-- user_org_ids(), que devolve conjunto vazio para quem não está autenticado.

drop policy if exists cq_admin on comm_queue;
drop policy if exists cq_client_read on comm_queue;
create policy comm_queue_select on comm_queue for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy comm_queue_ins on comm_queue for insert with check (is_salestrack_admin());
create policy comm_queue_upd on comm_queue for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy comm_queue_del on comm_queue for delete using (is_salestrack_admin());

drop policy if exists cc_admin on comms_consent;
drop policy if exists cc_client_read on comms_consent;
create policy comms_consent_select on comms_consent for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy comms_consent_ins on comms_consent for insert with check (is_salestrack_admin());
create policy comms_consent_upd on comms_consent for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy comms_consent_del on comms_consent for delete using (is_salestrack_admin());

drop policy if exists cd_admin on comms_delivery;
drop policy if exists cd_client_read on comms_delivery;
create policy comms_delivery_select on comms_delivery for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy comms_delivery_ins on comms_delivery for insert with check (is_salestrack_admin());
create policy comms_delivery_upd on comms_delivery for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy comms_delivery_del on comms_delivery for delete using (is_salestrack_admin());

drop policy if exists fc_admin on formacao_certificados;
drop policy if exists fc_client_read on formacao_certificados;
create policy formacao_certificados_select on formacao_certificados for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy formacao_certificados_ins on formacao_certificados for insert with check (is_salestrack_admin());
create policy formacao_certificados_upd on formacao_certificados for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy formacao_certificados_del on formacao_certificados for delete using (is_salestrack_admin());

drop policy if exists regua_admin on regua;
drop policy if exists regua_client_read on regua;
create policy regua_select on regua for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy regua_ins on regua for insert with check (is_salestrack_admin());
create policy regua_upd on regua for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy regua_del on regua for delete using (is_salestrack_admin());

drop policy if exists regua_step_admin on regua_step;
drop policy if exists regua_step_client_read on regua_step;
create policy regua_step_select on regua_step for select
  using (is_salestrack_admin() or regua_id in (select id from regua where org_id in (select user_org_ids())));
create policy regua_step_ins on regua_step for insert with check (is_salestrack_admin());
create policy regua_step_upd on regua_step for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy regua_step_del on regua_step for delete using (is_salestrack_admin());

drop policy if exists pi_write on programa_identidade;
drop policy if exists pi_read on programa_identidade;
create policy programa_identidade_select on programa_identidade for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy programa_identidade_ins on programa_identidade for insert with check (is_salestrack_admin());
create policy programa_identidade_upd on programa_identidade for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy programa_identidade_del on programa_identidade for delete using (is_salestrack_admin());
