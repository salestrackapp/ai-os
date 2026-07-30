-- 048 · Fase 3 Bloco 1: contagem para o limite de taxa da captura pública
--
-- O formulário usa a chave ANÔNIMA, e a policy de leitura de site_leads é só de admin — de
-- propósito: lead é dado pessoal e não pode ser listado por quem tem a chave pública.
--
-- Mas o limite de taxa precisa contar quantos envios vieram do mesmo IP na última janela.
-- Esta função resolve a tensão devolvendo um NÚMERO, nunca uma linha: quem chama descobre
-- "quantos", jamais "quem". SECURITY DEFINER para passar por cima da RLS de leitura, com
-- search_path fixo (convenção da casa desde a migration 028).
--
-- Com p_ip_hash nulo a comparação nunca casa e o retorno é 0 — não vaza contagem global.
-- A janela é limitada a 1440 minutos para a função não virar um contador de tudo.
create or replace function site_leads_recentes_por_ip(p_ip_hash text, p_minutos int default 10)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from site_leads
   where ip_hash = p_ip_hash
     and created_at > now() - make_interval(mins => greatest(1, least(p_minutos, 1440)));
$$;

revoke execute on function site_leads_recentes_por_ip(text, int) from public;
grant execute on function site_leads_recentes_por_ip(text, int) to anon, authenticated;

comment on function site_leads_recentes_por_ip(text, int) is
'Conta envios recentes do mesmo ip_hash, para o limite de taxa da captura pública. Devolve NÚMERO, nunca linha.';
