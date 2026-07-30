-- E0 · Relacionamento — inbox compartilhado de equipe (channel-agnostic email|whatsapp).
-- Canais DA Salestrack; vínculo a cliente = etiqueta/CRM (client_id/deal_id/contact_id).
-- RLS: equipe Salestrack (is_salestrack_admin) lê/escreve a inbox compartilhada.
-- Aditivo; reusa Fase 5/5.5 (contacts, deals, wa_messages, Gmail) por referência, sem duplicar.

-- Conversa (estado genérico, serve para os dois canais) --------------------------------
create table if not exists rel_conversas (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,   -- org dona (Salestrack)
  channel       text not null check (channel in ('email','whatsapp')),
  external_ref  text,                                                            -- thread id (Gmail) / telefone (WA)
  assunto       text,
  contato_nome  text,
  contato_email text,
  contato_phone text,
  status        text not null default 'aberta' check (status in ('aberta','aguardando','respondida','arquivada')),
  assigned_to   uuid,                                                            -- membro (auth.uid) responsável
  snooze_until  timestamptz,
  client_id     uuid references organizations(id) on delete set null,           -- vínculo CRM (org do cliente)
  deal_id       uuid references deals(id) on delete set null,
  contact_id    uuid references contacts(id) on delete set null,
  unread        boolean not null default true,
  last_message_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_rel_conv_org on rel_conversas(org_id) where deleted_at is null;
create index if not exists idx_rel_conv_status on rel_conversas(status, channel) where deleted_at is null;
create index if not exists idx_rel_conv_assigned on rel_conversas(assigned_to) where deleted_at is null;
create index if not exists idx_rel_conv_client on rel_conversas(client_id) where deleted_at is null;
create unique index if not exists uq_rel_conv_channel_ref on rel_conversas(channel, external_ref) where external_ref is not null and deleted_at is null;

-- Mensagem (in|out) dentro de uma conversa ---------------------------------------------
create table if not exists rel_mensagens (
  id            uuid primary key default gen_random_uuid(),
  conversa_id   uuid not null references rel_conversas(id) on delete cascade,
  direction     text not null check (direction in ('in','out')),
  corpo         text,
  media         jsonb not null default '[]'::jsonb,        -- refs de anexos/mídia (sem PII gravada além do necessário)
  status_entrega text check (status_entrega in ('enviado','falhou','manual','recebido','lido')),
  provider_ref  text,
  external_ref  text,                                       -- id da mensagem no provedor
  sent_by       uuid,                                       -- membro que enviou (out)
  created_at    timestamptz not null default now()
);
create index if not exists idx_rel_msg_conv on rel_mensagens(conversa_id, created_at);

-- Rótulos (marcadores) ------------------------------------------------------------------
create table if not exists rel_rotulos (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  nome       text not null,
  cor        text,
  created_at timestamptz not null default now(),
  unique (org_id, nome)
);
create table if not exists rel_conversa_rotulos (
  conversa_id uuid not null references rel_conversas(id) on delete cascade,
  rotulo_id   uuid not null references rel_rotulos(id) on delete cascade,
  primary key (conversa_id, rotulo_id)
);

-- Rascunho por conversa/membro ----------------------------------------------------------
create table if not exists rel_rascunhos (
  id          uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references rel_conversas(id) on delete cascade,
  user_id     uuid not null,
  corpo       text,
  updated_at  timestamptz not null default now(),
  unique (conversa_id, user_id)
);

-- Notificações in-app (base para e-mail/push depois) -----------------------------------
create table if not exists rel_notificacoes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid,                                          -- destinatário (null = para toda a equipe)
  tipo        text not null check (tipo in ('nova_conversa','nova_mensagem','atribuicao','followup_vencido')),
  conversa_id uuid references rel_conversas(id) on delete cascade,
  titulo      text,
  payload     jsonb not null default '{}'::jsonb,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_rel_notif_user on rel_notificacoes(user_id, lida) where lida = false;
create index if not exists idx_rel_notif_org on rel_notificacoes(org_id, created_at desc);

-- RLS: inbox compartilhada da EQUIPE Salestrack ----------------------------------------
alter table rel_conversas enable row level security;
alter table rel_mensagens enable row level security;
alter table rel_rotulos enable row level security;
alter table rel_conversa_rotulos enable row level security;
alter table rel_rascunhos enable row level security;
alter table rel_notificacoes enable row level security;

drop policy if exists rel_conv_team on rel_conversas;
create policy rel_conv_team on rel_conversas for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

drop policy if exists rel_msg_team on rel_mensagens;
create policy rel_msg_team on rel_mensagens for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

drop policy if exists rel_rot_team on rel_rotulos;
create policy rel_rot_team on rel_rotulos for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

drop policy if exists rel_convrot_team on rel_conversa_rotulos;
create policy rel_convrot_team on rel_conversa_rotulos for all to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());

-- rascunho: da equipe, mas cada membro só mexe no PRÓPRIO rascunho
drop policy if exists rel_rasc_own on rel_rascunhos;
create policy rel_rasc_own on rel_rascunhos for all to authenticated using (is_salestrack_admin() and user_id = auth.uid()) with check (is_salestrack_admin() and user_id = auth.uid());

-- notificações: equipe lê; cada membro vê as suas + as da equipe (user_id null)
drop policy if exists rel_notif_team on rel_notificacoes;
create policy rel_notif_team on rel_notificacoes for all to authenticated using (is_salestrack_admin() and (user_id = auth.uid() or user_id is null)) with check (is_salestrack_admin());
