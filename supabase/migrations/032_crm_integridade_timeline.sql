-- 032 · Integridade do CRM: vínculo prospect→org, soft delete em contacts/deals, timeline unificada
-- Aditivo e reversível: nenhum DROP de tabela ou coluna.

-- 1) Vínculo explícito conta-de-prospecção → organização do CRM.
-- Sem isto, converter dois prospects da mesma empresa criava duas organizações duplicadas,
-- porque não havia como saber que a conta já tinha virado org.
alter table prospect_accounts add column if not exists org_id uuid references organizations(id);
create index if not exists idx_prospect_accounts_org on prospect_accounts(org_id);

-- 2) Soft delete em contacts e deals (convenção das migrations 018/019/020).
-- deleteContact fazia DELETE físico: um contato apagado por engano levava junto o rastro comercial.
alter table contacts add column if not exists deleted_at timestamptz;
alter table deals    add column if not exists deleted_at timestamptz;
create index if not exists idx_contacts_alive on contacts(deleted_at) where deleted_at is null;
create index if not exists idx_deals_alive    on deals(deleted_at)    where deleted_at is null;

-- 3) Timeline unificada do negócio.
-- Existem duas trilhas paralelas que nunca conversaram: activities (escopo de deal, com org_id) e
-- timeline_events (polimórfica, usada na prospecção). Ao converter um prospect em deal, todo o
-- histórico de prospecção ficava órfão do negócio.
--
-- A view resolve isso por JOIN, sem mover nenhuma linha: o histórico continua visível no prospect
-- E aparece no negócio, seguindo prospects.deal_id. Nada a migrar, nada a perder dos dois lados.
--
-- security_invoker = on é OBRIGATÓRIO: sem isso a view rodaria com os privilégios do dono e
-- contornaria a RLS das tabelas de baixo, expondo histórico de um cliente a outro.
create or replace view deal_timeline
with (security_invoker = on) as
  select a.id,
         a.ref_id                                   as deal_id,
         a.org_id,
         'atividade'::text                          as fonte,
         a.kind,
         coalesce(a.payload->>'event', a.kind)      as summary,
         a.created_at                               as occurred_at
    from activities a
   where a.ref_table = 'deals' and a.ref_id is not null

  union all

  select t.id, t.subject_id, null::uuid, 'timeline'::text, t.kind, t.summary, t.occurred_at
    from timeline_events t
   where t.subject_type = 'deal'

  union all

  -- histórico de quando ainda era prospect, trazido para o negócio que ele virou
  select t.id, p.deal_id, null::uuid, 'prospeccao'::text, t.kind, t.summary, t.occurred_at
    from timeline_events t
    join prospects p on p.id = t.subject_id
   where t.subject_type = 'prospect' and p.deal_id is not null;
