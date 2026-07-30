-- 060 · Régua de cobrança
--
-- ── O que estava acontecendo ─────────────────────────────────────────────────────────────────
-- O AI OS registrava R$ 12.100 em aberto da IMAGO — R$ 3.000 vencidos havia 18 dias — sem link de
-- pagamento em nenhuma das cinco faturas, sem aviso de vencimento e sem nenhum cron tocando em
-- `invoices`. Registrar dívida sem cobrar não é controle financeiro; é uma planilha com passos
-- extras.
--
-- ── E a causa mais funda, achada na investigação ─────────────────────────────────────────────
-- A chave do ASAAS configurada é a de SANDBOX. O financeiro nunca falou com a conta real: as
-- faturas foram criadas direto no banco e o webhook de pagamento aponta para o ambiente de teste,
-- então um pagamento real nunca chegaria aqui. Ver docs/CONFIG_PENDENTE.md item 10.
--
-- Por isso a régua NASCE parada, e o código sincroniza antes de enviar: com o ambiente errado, ela
-- geraria boleto duplicado ou cobraria quem já pagou.

alter table invoices add column if not exists cobranca_gerada_em timestamptz;
alter table invoices add column if not exists aviso_previo_em timestamptz;
alter table invoices add column if not exists aviso_vencimento_em timestamptz;
alter table invoices add column if not exists aviso_atraso_em timestamptz;
alter table invoices add column if not exists ultimo_erro_cobranca text;

create index if not exists idx_invoices_abertas on invoices (due_date) where status <> 'paga';
create index if not exists idx_invoices_sem_link on invoices (due_date)
  where status <> 'paga' and stripe_invoice_id is null;

-- Onde cada aviso foi parar. Sem isto não há como responder "avisamos?" — e a resposta honesta a
-- essa pergunta é o que separa cobrança de constrangimento.
create table if not exists cobranca_avisos (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  org_id uuid references organizations(id),
  etapa text not null,
  destinatario text,
  canal text not null default 'email',
  enviado boolean not null default false,
  erro text,
  created_at timestamptz not null default now(),
  constraint ca_etapa_check check (etapa in ('previo','vencimento','atraso','interno')),
  constraint ca_canal_check check (canal in ('email','whatsapp','app'))
);
create index if not exists idx_ca_invoice on cobranca_avisos (invoice_id, created_at desc);

alter table cobranca_avisos enable row level security;
drop policy if exists cobranca_avisos_select on cobranca_avisos;
drop policy if exists cobranca_avisos_ins on cobranca_avisos;
drop policy if exists cobranca_avisos_upd on cobranca_avisos;
drop policy if exists cobranca_avisos_del on cobranca_avisos;
-- Exceção deliberada ao padrão "interno da Salestrack": o cliente VÊ as cobranças que recebeu.
-- Quem é cobrado tem direito de saber quando e para onde a cobrança foi — e quando alguém
-- contesta ("não recebi nada"), a resposta precisa estar do lado dele também, não só do nosso.
create policy cobranca_avisos_select on cobranca_avisos for select
  using (is_salestrack_admin() or org_id in (select user_org_ids()));
create policy cobranca_avisos_ins on cobranca_avisos for insert with check (is_salestrack_admin());
create policy cobranca_avisos_upd on cobranca_avisos for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy cobranca_avisos_del on cobranca_avisos for delete using (is_salestrack_admin());
