-- AI OS · Migration 004 · Fase 2: Propostas + WhatsApp
-- (numerada 004 porque 003 já foi usada em Fase 1.6 — split de marcas + tarefas)

-- Acesso público seguro por token (capability link)
alter table proposals add column if not exists access_token text unique
  default encode(gen_random_bytes(24), 'hex');
alter table proposals add column if not exists valid_until date;
alter table proposals add column if not exists timeline jsonb;          -- fases: [{n, titulo, meses, descricao}]
alter table proposals add column if not exists roi_note text;
alter table proposals add column if not exists conditions_md text;      -- condições comerciais
alter table proposals add column if not exists client_name text;        -- destinatário
alter table proposals add column if not exists client_email text;

-- Eventos da proposta (leitura por seção, decisões)
create table if not exists proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  kind text not null,             -- viewed | section_read | approved | adjust_requested | refused
  payload jsonb,                  -- {section, seconds} | {name, role, note}
  ip inet,
  created_at timestamptz not null default now()
);
alter table proposal_events enable row level security;
create policy admin_all_proposal_events on proposal_events
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
-- página pública grava via service role (server), sem policy anon

-- Mensagens WhatsApp (adapter multicanal)
create table if not exists wa_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  direction text not null,        -- out | in
  provider wa_provider not null default 'zapi',
  to_phone text, from_phone text,
  body text,
  status text not null default 'enviando',   -- enviando|enviado|entregue|lido|erro
  provider_ref text,
  ref_table text, ref_id uuid,
  created_at timestamptz not null default now()
);
alter table wa_messages enable row level security;
create policy admin_all_wa_messages on wa_messages
  for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
