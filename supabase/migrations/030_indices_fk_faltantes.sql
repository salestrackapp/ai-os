-- 030 · Performance: índices nas 62 chaves estrangeiras sem apoio + 2 índices de consulta do CRM
-- Aditivo e reversível: nenhum DROP. Só create index if not exists.
--
-- FK sem índice custa em dois momentos: JOIN pelo lado filho vira varredura sequencial, e todo
-- delete/update no pai precisa varrer o filho inteiro para checar a referência.
--
-- Destaque: memberships(user_id) é lido por user_org_ids() e is_salestrack_admin(), ou seja,
-- por praticamente toda avaliação de RLS do sistema.

create index if not exists idx_memberships_user on memberships(user_id);

-- CRM / comercial
create index if not exists idx_contacts_org on contacts(org_id);
create index if not exists idx_deals_org on deals(org_id);
create index if not exists idx_deals_contact on deals(contact_id);
create index if not exists idx_proposals_org on proposals(org_id);
create index if not exists idx_proposals_deal on proposals(deal_id);
create index if not exists idx_proposal_events_proposal on proposal_events(proposal_id);
create index if not exists idx_contracts_org on contracts(org_id);
create index if not exists idx_contracts_proposal on contracts(proposal_id);
create index if not exists idx_contract_events_contract on contract_events(contract_id);
create index if not exists idx_invoices_org on invoices(org_id);
create index if not exists idx_invoices_contract on invoices(contract_id);
create index if not exists idx_subscriptions_org on subscriptions(org_id);
create index if not exists idx_subscriptions_contract on subscriptions(contract_id);
create index if not exists idx_tasks_org on tasks(org_id);

-- Prospecção / cadências
create index if not exists idx_prospects_deal on prospects(deal_id);
create index if not exists idx_cadence_enroll_cadence on cadence_enrollments(cadence_id);
create index if not exists idx_cadence_enroll_prospect on cadence_enrollments(prospect_id);
create index if not exists idx_cadence_step_log_enrollment on cadence_step_log(enrollment_id);
create index if not exists idx_outreach_prospect on outreach_messages(prospect_id);
create index if not exists idx_tenant_prov_org on tenant_provisioning(org_id);
create index if not exists idx_tenant_prov_deal on tenant_provisioning(deal_id);

-- Relacionamento (inbox)
create index if not exists idx_rel_conv_contact on rel_conversas(contact_id);
create index if not exists idx_rel_conv_deal on rel_conversas(deal_id);
create index if not exists idx_rel_convrot_rotulo on rel_conversa_rotulos(rotulo_id);
create index if not exists idx_rel_notif_conversa on rel_notificacoes(conversa_id);
create index if not exists idx_wa_messages_org on wa_messages(org_id);
create index if not exists idx_messages_org on messages(org_id);

-- Comunicação / régua
create index if not exists idx_comm_queue_asset on comm_queue(asset_ref);
create index if not exists idx_comm_queue_delivery on comm_queue(delivery_id);
create index if not exists idx_comm_queue_step on comm_queue(regua_step_id);
create index if not exists idx_regua_step_asset on regua_step(asset_ref);

-- Entrega / programas
create index if not exists idx_projects_org on projects(org_id);
create index if not exists idx_projects_contract on projects(contract_id);
create index if not exists idx_deliverables_org on deliverables(org_id);
create index if not exists idx_deliverables_project on deliverables(project_id);
create index if not exists idx_library_assets_org on library_assets(org_id);
create index if not exists idx_sessions_org on sessions(org_id);
create index if not exists idx_sessions_catalog on sessions(catalog_id);
create index if not exists idx_studio_deliverables_parent on studio_deliverables(parent_id);

-- Playbook / trilhas
create index if not exists idx_playbook_recipes_trilha on playbook_recipes(trilha_id);
create index if not exists idx_recipe_progress_recipe on recipe_progress(recipe_id);

-- Agentes / IA
create index if not exists idx_agent_conv_org on agent_conversations(org_id);
create index if not exists idx_agent_conv_agent on agent_conversations(agent_id);
create index if not exists idx_memories_org on memories(org_id);
create index if not exists idx_orchestrations_org on orchestrations(org_id);
create index if not exists idx_client_ai_stack_platform on client_ai_stack(platform_id);
create index if not exists idx_platform_benchmarks_platform on platform_benchmarks(platform_id);
create index if not exists idx_skill_deployments_org on skill_deployments(org_id);

-- Governança / plataforma
create index if not exists idx_ai_policies_org on ai_policies(org_id);
create index if not exists idx_ai_policy_acc_org on ai_policy_acceptances(org_id);
create index if not exists idx_ai_policy_acc_user on ai_policy_acceptances(user_id);
create index if not exists idx_alerts_org on alerts(org_id);
create index if not exists idx_app_settings_org on app_settings(org_id);
create index if not exists idx_audit_logs_org on audit_logs(org_id);
create index if not exists idx_connector_tokens_org on connector_tokens(org_id);
create index if not exists idx_openapi_tokens_org on openapi_tokens(org_id);
create index if not exists idx_openapi_tokens_platform on openapi_tokens(platform_id);
create index if not exists idx_custom_domains_org on custom_domains(org_id);
create index if not exists idx_integration_secrets_org on integration_secrets(org_id);
create index if not exists idx_invites_org on invites(org_id);
create index if not exists idx_onboarding_progress_org on onboarding_progress(org_id);

-- Padrões de consulta do CRM que não são FK
create index if not exists idx_deals_stage on deals(stage);          -- colunas do Kanban
create index if not exists idx_contacts_email on contacts(email);    -- deduplicação por e-mail
