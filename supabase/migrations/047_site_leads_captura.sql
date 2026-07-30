-- 047 · Fase 3 Bloco 1: captura de lead no site institucional
--
-- `site_leads` existia desde o início com policy de insert anônimo, e NADA escrevia nela.
-- O único CTA do salestrack.com.br é um link de WhatsApp: quem converte hoje sai da página
-- e não deixa rastro no CRM. Estas colunas são o mínimo para um lead B2B ser útil.
alter table site_leads add column if not exists whatsapp text;
alter table site_leads add column if not exists empresa text;
-- Para o limite de taxa e para investigar abuso. IP é dado pessoal sob a LGPD: guardamos o
-- HASH, não o endereço — serve para contar repetição sem identificar a pessoa.
alter table site_leads add column if not exists ip_hash text;
alter table site_leads add column if not exists user_agent text;

create index if not exists ix_site_leads_criado on site_leads(created_at desc);
create index if not exists ix_site_leads_ip on site_leads(ip_hash, created_at desc);
create index if not exists ix_site_leads_email on site_leads(email);

-- A policy de insert anônimo é `with check (true)`: qualquer um insere em volume. O limite de
-- taxa fica na rota (não dá para contar janela de tempo dentro de uma policy sem expor leitura),
-- mas o índice acima é o que torna essa contagem barata.
--
-- Leitura: só admin Salestrack. Marketing é dado da empresa, não do cliente.
drop policy if exists site_leads_select_admin on site_leads;
create policy site_leads_select_admin on site_leads for select to authenticated
  using (is_salestrack_admin());
drop policy if exists site_leads_upd_admin on site_leads;
create policy site_leads_upd_admin on site_leads for update to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists site_leads_del_admin on site_leads;
create policy site_leads_del_admin on site_leads for delete to authenticated
  using (is_salestrack_admin());
