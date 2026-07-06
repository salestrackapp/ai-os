-- AI OS · Migration 010 · Fase 5: Consultor do Programa + Agentes internos
-- (renumerada de 007 no prompt → 010, pois 007/008/009 já existem)
-- Reusa a tabela `memories` (pgvector) da Fase 1 com scope='client'.

-- Prompts de agentes internos, versionados
create table if not exists agent_prompts (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,              -- consultor_programa | agente_sucesso
  versao int not null default 1,
  system_prompt text not null,
  ativo boolean not null default true,
  performance jsonb default '{}',
  created_at timestamptz not null default now(),
  unique (agent_key, versao)
);

-- Conversas do Consultor (por org)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_key text not null default 'consultor_programa',
  canal text not null default 'portal', -- portal | whatsapp | slack
  aberta_por uuid,
  created_at timestamptz not null default now()
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null,                   -- user | assistant | system
  content text not null,
  tokens int,
  autor text,                           -- null=agente; 'humano' quando o admin assume
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_conversations_org on conversations(org_id, created_at desc);

-- Relatórios de ROI / narrativa mensal (por org)
create table if not exists roi_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  periodo date not null,                -- 1º dia do mês de referência
  metricas jsonb not null default '{}', -- adoção playbook, sessões, entregáveis
  narrativa text,
  publicado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, periodo)
);

alter table agent_prompts enable row level security;
alter table conversations enable row level security;
alter table messages      enable row level security;
alter table roi_reports   enable row level security;

create policy prompts_admin on agent_prompts for all to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());

create policy conv_own on conversations for all to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin())
  with check (org_id in (select user_org_ids()) or is_salestrack_admin());
create policy msg_own on messages for all to authenticated
  using (org_id in (select user_org_ids()) or is_salestrack_admin())
  with check (org_id in (select user_org_ids()) or is_salestrack_admin());

create policy roi_read on roi_reports for select to authenticated
  using ((publicado and org_id in (select user_org_ids())) or is_salestrack_admin());
create policy roi_admin on roi_reports for all to authenticated
  using (is_salestrack_admin()) with check (is_salestrack_admin());
