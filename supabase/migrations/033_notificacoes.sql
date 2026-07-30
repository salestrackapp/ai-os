-- 033 · Notificações: registro in-app + preferência por evento e canal
-- Aditivo e reversível: nenhum DROP.
--
-- Canais: in_app e email. WhatsApp ficou de fora de propósito — o sistema não guarda telefone
-- por usuário (memberships não tem, auth.users não tem), então um botão de WhatsApp aqui seria
-- um interruptor que não faz nada. Quando existir telefone por usuário, acrescenta-se a coluna.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                                  -- destinatário (auth.users.id)
  org_id uuid references organizations(id) on delete cascade,
  event text not null,                                    -- chave do catálogo (lib/notifications/events.ts)
  title text not null,
  body text,
  url text,                                               -- rota interna para abrir direto o registro
  entity_type text,
  entity_id uuid,
  actor_id uuid,                                          -- quem causou (null = sistema)
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_unread on notifications(user_id, read) where read = false;
create index if not exists idx_notifications_user_time on notifications(user_id, created_at desc);
create index if not exists idx_notifications_org on notifications(org_id);

-- Esparsa de propósito: linha ausente significa "usa o padrão do catálogo".
create table if not exists notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, event)
);
create index if not exists idx_notification_prefs_user on notification_prefs(user_id);

-- Idempotência do cron de tarefas: sem estes marcadores, cada execução reavisaria a mesma tarefa.
alter table tasks add column if not exists notified_due_soon boolean not null default false;
alter table tasks add column if not exists notified_overdue  boolean not null default false;

-- RLS: notificação é pessoal. Cada um vê e marca como lida apenas a sua — nem admin lê a dos outros.
-- A escrita é feita pelo despachante com service_role (que ignora RLS), então não há policy de insert.
alter table notifications enable row level security;
drop policy if exists notif_own on notifications;
create policy notif_own on notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table notification_prefs enable row level security;
drop policy if exists notif_prefs_own on notification_prefs;
create policy notif_prefs_own on notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Realtime: o sino assina a tabela em vez de ficar consultando de tempos em tempos.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
