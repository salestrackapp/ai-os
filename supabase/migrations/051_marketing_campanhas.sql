-- 051 · Fase 3 Bloco 4: campanhas, origem normalizada e atribuição
--
-- Ordem deliberada: este bloco só veio DEPOIS de existir captura funcionando (Bloco 1) e
-- disparo funcionando (Blocos 2 e 3). Atribuição construída antes de haver fluxo mede o vazio.
--
-- Atribuição por ÚLTIMO TOQUE na v1. Multi-toque é mais justo, mas exige volume para significar
-- alguma coisa — e hoje há zero leads. Começar simples é o que permite corrigir depois com dado
-- real na mão, em vez de escolher um modelo sofisticado no escuro.
--
-- (Conteúdo idêntico ao aplicado em produção: lead_sources, campaigns, campaign_touches,
--  colunas de origem em contacts, view deal_attribution e RLS admin-only.)
create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  canal text not null default 'site'
    constraint ls_canal_check check (canal in ('site','social','indicacao','evento','anuncio','prospeccao','conteudo','outro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into lead_sources (slug, nome, canal) values
  ('salestrack-site',   'Site institucional (salestrack.com.br)', 'site'),
  ('andrekachan-site',  'Site do André (andrekachan.com.br)',     'site'),
  ('indicacao',         'Indicação',                              'indicacao'),
  ('linkedin-organico', 'LinkedIn orgânico',                      'social'),
  ('prospeccao-ativa',  'Prospecção ativa (cadência)',            'prospeccao')
on conflict (slug) do nothing;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  lead_source_id uuid references lead_sources(id) on delete set null,
  canal text not null default 'conteudo'
    constraint cp_canal_check check (canal in ('site','social','indicacao','evento','anuncio','prospeccao','conteudo','email','outro')),
  inicio date not null default current_date,
  fim date,
  custo_centavos int not null default 0 constraint cp_custo_check check (custo_centavos >= 0),
  meta_leads int constraint cp_meta_check check (meta_leads is null or meta_leads >= 0),
  status text not null default 'planejada'
    constraint cp_status_check check (status in ('planejada','ativa','encerrada','cancelada')),
  observacao text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint cp_periodo_check check (fim is null or fim >= inicio)
);
create index if not exists ix_campaigns_alive on campaigns(deleted_at) where deleted_at is null;
create index if not exists ix_campaigns_periodo on campaigns(inicio, fim);

create table if not exists campaign_touches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  tipo text not null default 'formulario'
    constraint ct_tipo_check check (tipo in ('impressao','clique','visita','formulario','resposta','reuniao','outro')),
  occurred_at timestamptz not null default now(),
  detalhe text,
  created_at timestamptz not null default now()
);
create index if not exists ix_ct_campaign on campaign_touches(campaign_id);
create index if not exists ix_ct_contact on campaign_touches(contact_id, occurred_at desc);

alter table contacts add column if not exists lead_source_id uuid references lead_sources(id) on delete set null;
alter table contacts add column if not exists lead_ref text;
alter table contacts add column if not exists origem_detalhe text;
create index if not exists ix_contacts_lead_source on contacts(lead_source_id);
create unique index if not exists uq_contacts_lead_ref on contacts(lead_ref) where lead_ref is not null;
create unique index if not exists uq_contacts_email_vivo on contacts(lower(email)) where email is not null and deleted_at is null;

create or replace view deal_attribution
with (security_invoker = on) as
select
  d.id as deal_id, d.title as deal, d.stage, d.value_estimated, d.created_at as deal_criado_em,
  c.id as contact_id, c.name as contato,
  ls.slug as origem_slug, ls.nome as origem, ls.canal as origem_canal,
  t.campaign_id, cp.nome as campanha, t.tipo as ultimo_toque_tipo, t.occurred_at as ultimo_toque_em
from deals d
left join contacts c on c.id = d.contact_id
left join lead_sources ls on ls.id = c.lead_source_id
left join lateral (
  select tt.* from campaign_touches tt
   where tt.contact_id = c.id and tt.occurred_at <= d.created_at
   order by tt.occurred_at desc limit 1
) t on true
left join campaigns cp on cp.id = t.campaign_id
where d.deleted_at is null;

alter table lead_sources enable row level security;
alter table campaigns enable row level security;
alter table campaign_touches enable row level security;

drop policy if exists lead_sources_select on lead_sources;
create policy lead_sources_select on lead_sources for select to authenticated using (is_salestrack_admin());
drop policy if exists lead_sources_ins on lead_sources;
create policy lead_sources_ins on lead_sources for insert to authenticated with check (is_salestrack_admin());
drop policy if exists lead_sources_upd on lead_sources;
create policy lead_sources_upd on lead_sources for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists lead_sources_del on lead_sources;
create policy lead_sources_del on lead_sources for delete to authenticated using (is_salestrack_admin());

drop policy if exists campaigns_select on campaigns;
create policy campaigns_select on campaigns for select to authenticated using (is_salestrack_admin());
drop policy if exists campaigns_ins on campaigns;
create policy campaigns_ins on campaigns for insert to authenticated with check (is_salestrack_admin());
drop policy if exists campaigns_upd on campaigns;
create policy campaigns_upd on campaigns for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists campaigns_del on campaigns;
create policy campaigns_del on campaigns for delete to authenticated using (is_salestrack_admin());

drop policy if exists campaign_touches_select on campaign_touches;
create policy campaign_touches_select on campaign_touches for select to authenticated using (is_salestrack_admin());
drop policy if exists campaign_touches_ins on campaign_touches;
create policy campaign_touches_ins on campaign_touches for insert to authenticated with check (is_salestrack_admin());
drop policy if exists campaign_touches_upd on campaign_touches;
create policy campaign_touches_upd on campaign_touches for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists campaign_touches_del on campaign_touches;
create policy campaign_touches_del on campaign_touches for delete to authenticated using (is_salestrack_admin());
