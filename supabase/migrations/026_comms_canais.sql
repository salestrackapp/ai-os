-- R4.2 · Canais: registro de entrega + consentimento. PII só no envio (não gravamos o conteúdo resolvido).
create table if not exists comms_delivery (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  deliverable_id uuid references studio_deliverables(id),
  deliverable_version int,
  canal text not null,                               -- whatsapp | email
  destinatario text not null,                        -- e-mail ou telefone (endereço, não o conteúdo)
  status text not null default 'pendente',           -- enviado | falhou | pendente | manual | bloqueado
  provider_ref text,
  erro text,
  test boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cd_canal_check check (canal in ('whatsapp','email')),
  constraint cd_status_check check (status in ('enviado','falhou','pendente','manual','bloqueado'))
);
create index if not exists idx_cd_org on comms_delivery (org_id);
create index if not exists idx_cd_deliverable on comms_delivery (deliverable_id);

create table if not exists comms_consent (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  canal text not null,                               -- whatsapp | email
  endereco text not null,                            -- telefone ou e-mail
  opt_in boolean not null default false,
  base text,                                         -- base do consentimento (ex.: "aceite no onboarding")
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint cc_canal_check check (canal in ('whatsapp','email')),
  unique (org_id, canal, endereco)
);
create index if not exists idx_cc_lookup on comms_consent (org_id, canal, endereco);

alter table comms_delivery enable row level security;
alter table comms_consent enable row level security;
drop policy if exists cd_admin on comms_delivery;
create policy cd_admin on comms_delivery for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists cd_client_read on comms_delivery;
create policy cd_client_read on comms_delivery for select using (org_id in (select user_org_ids()));
drop policy if exists cc_admin on comms_consent;
create policy cc_admin on comms_consent for all using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists cc_client_read on comms_consent;
create policy cc_client_read on comms_consent for select using (org_id in (select user_org_ids()));
