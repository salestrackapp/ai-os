-- 049 · Fase 3 Bloco 1b: aviso de lead novo e paridade entre os dois sites
--
-- `notificado_em` é o que torna o aviso IDEMPOTENTE e recuperável: o site chama o AI OS na
-- hora (aviso imediato), mas se essa chamada falhar o lead já está salvo — nunca se perde um
-- lead por falha de notificação. A varredura de cron pega os que ficaram com notificado_em
-- nulo. Sem esta coluna, a varredura reenviaria tudo a cada passada.
alter table site_leads        add column if not exists notificado_em timestamptz;
alter table andrekachan_leads add column if not exists notificado_em timestamptz;

-- Paridade: o site do André não tinha os campos anti-abuso nem empresa.
alter table andrekachan_leads add column if not exists empresa text;
alter table andrekachan_leads add column if not exists ip_hash text;
alter table andrekachan_leads add column if not exists user_agent text;

create index if not exists ix_site_leads_pendente on site_leads(created_at) where notificado_em is null;
create index if not exists ix_ak_leads_pendente on andrekachan_leads(created_at) where notificado_em is null;
create index if not exists ix_ak_leads_ip on andrekachan_leads(ip_hash, created_at desc);
create index if not exists ix_ak_leads_criado on andrekachan_leads(created_at desc);

-- Leitura de andrekachan_leads: só admin Salestrack, como em site_leads.
-- Antes a tabela só tinha policy de insert anônimo e de service_role — nenhum admin logado lia.
drop policy if exists ak_leads_select_admin on andrekachan_leads;
create policy ak_leads_select_admin on andrekachan_leads for select to authenticated
  using (is_salestrack_admin());
drop policy if exists ak_leads_upd_admin on andrekachan_leads;
create policy ak_leads_upd_admin on andrekachan_leads for update to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists ak_leads_del_admin on andrekachan_leads;
create policy ak_leads_del_admin on andrekachan_leads for delete to authenticated
  using (is_salestrack_admin());

create or replace function ak_leads_recentes_por_ip(p_ip_hash text, p_minutos int default 10)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from andrekachan_leads
   where ip_hash = p_ip_hash
     and created_at > now() - make_interval(mins => greatest(1, least(p_minutos, 1440)));
$$;
revoke execute on function ak_leads_recentes_por_ip(text, int) from public;
grant execute on function ak_leads_recentes_por_ip(text, int) to anon, authenticated;
