-- R4.3 · Orquestração: fila de disparo idempotente + modo por passo + kill switch. Aditivo/reversível.
alter table regua_step add column if not exists modo text not null default 'supervisionado';
alter table regua_step drop constraint if exists regua_step_modo_check;
alter table regua_step add constraint regua_step_modo_check check (modo in ('supervisionado','automatico'));
alter table regua add column if not exists paused boolean not null default false;   -- kill switch por régua/programa

create table if not exists comm_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  program_id uuid references projects(id),
  regua_step_id uuid references regua_step(id),
  canal text not null,                               -- whatsapp | email
  recipient jsonb not null default '{}'::jsonb,       -- snapshot {nome,email,phone} (PII resolvida no dispatch, não aqui)
  asset_ref uuid references studio_deliverables(id),
  asset_version int,
  scheduled_for timestamptz not null default now(),
  status text not null default 'aguardando_aprovacao', -- agendado | aguardando_aprovacao | enviado | falhou | cancelado
  idempotency_key text not null,                     -- programa:passo:destinatario:instancia-ciclo
  tentativas int not null default 0,
  erro text,
  delivery_id uuid references comms_delivery(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cq_status_check check (status in ('agendado','aguardando_aprovacao','enviado','falhou','cancelado')),
  constraint cq_idem_unique unique (idempotency_key)
);
create index if not exists idx_cq_org on comm_queue (org_id);
create index if not exists idx_cq_program on comm_queue (program_id);
create index if not exists idx_cq_status on comm_queue (status);

alter table comm_queue enable row level security;
drop policy if exists cq_admin on comm_queue;
create policy cq_admin on comm_queue for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists cq_client_read on comm_queue;
create policy cq_client_read on comm_queue for select using (org_id in (select user_org_ids()));
