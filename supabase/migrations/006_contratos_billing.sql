-- AI OS · Migration 006 · Fase 3: Contratos + Billing + Kickoff
-- (numerada 006 porque 004/005 já foram usadas em Fase 2)

alter table contracts add column if not exists content_html text;
alter table contracts add column if not exists sent_at timestamptz;
alter table contracts add column if not exists signer_name text;
alter table contracts add column if not exists signer_email text;
alter table contracts add column if not exists signed_manually boolean not null default false;

create table if not exists contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  kind text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table contract_events enable row level security;
create policy admin_all_contract_events on contract_events
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

alter table invoices add column if not exists kind text not null default 'mensalidade';
alter table invoices add column if not exists installment_n int;
alter table invoices add column if not exists installments_total int;
alter table invoices add column if not exists contract_id uuid references contracts(id);
alter table invoices add column if not exists hosted_url text;

alter table subscriptions add column if not exists contract_id uuid references contracts(id);

alter table projects add column if not exists kickoff_checklist jsonb;
alter table projects add column if not exists status text not null default 'onboarding';

-- Storage bucket para PDFs assinados
insert into storage.buckets (id, name, public) values ('contratos', 'contratos', false)
on conflict (id) do nothing;
