-- 042 · Academy · Bloco 5: Construtor de Agentes e estado das ferramentas
-- Aditivo e reversível: nenhum DROP.
--
-- Na academy antiga tudo isso vivia em localStorage['st-acad-v3']: por navegador, invisível ao
-- servidor, perdido ao trocar de máquina ou limpar o navegador. Os agentes que o aluno construía
-- eram o único dado realmente insubstituível do sistema antigo, e não tinham cópia em lugar nenhum.
--
-- Aqui passam a ser dele de verdade: seguem a conta, não o navegador.

-- Estado leve e pessoal das ferramentas (marcações do checklist, entradas do ROI, rascunho do
-- construtor). Mesma forma de notification_prefs: chave por usuário, ninguém mais lê — nem o admin.
create table if not exists academy_tool_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chave text not null
    constraint ats_chave_check check (chave in ('checklist_seguranca','roi_agente','builder_rascunho')),
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, chave)
);
create index if not exists ix_ats_user on academy_tool_state(user_id);

-- Agentes construídos pelo aluno.
create table if not exists academy_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid references organizations(id) on delete set null,
  nome text not null,
  area text,
  missao text,
  status text not null default 'rascunho'
    constraint aag_status_check check (status in ('rascunho','pronto','publicado')),
  dados jsonb not null default '{}'::jsonb,   -- as respostas do assistente, como o aluno preencheu
  system_prompt text,                         -- gerado; o aluno copia, não escreve
  tools_json jsonb,                           -- gerado; existe para quem for implementar
  compartilhado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ix_aag_user on academy_agents(user_id) where deleted_at is null;
create index if not exists ix_aag_org on academy_agents(org_id) where org_id is not null and deleted_at is null;

alter table academy_tool_state enable row level security;
alter table academy_agents enable row level security;

-- Estado das ferramentas: estritamente pessoal.
drop policy if exists academy_tool_state_select on academy_tool_state;
create policy academy_tool_state_select on academy_tool_state for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists academy_tool_state_ins on academy_tool_state;
create policy academy_tool_state_ins on academy_tool_state for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists academy_tool_state_upd on academy_tool_state;
create policy academy_tool_state_upd on academy_tool_state for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists academy_tool_state_del on academy_tool_state;
create policy academy_tool_state_del on academy_tool_state for delete to authenticated
  using (user_id = (select auth.uid()));

-- Agentes: do dono. O gestor da org só enxerga o que o aluno marcou como compartilhado,
-- e ainda assim apenas para leitura — nunca edita o agente de outra pessoa.
drop policy if exists academy_agents_select on academy_agents;
create policy academy_agents_select on academy_agents for select to authenticated
  using (
    is_salestrack_admin()
    or user_id = (select auth.uid())
    or (compartilhado and org_id is not null and org_id in (select academy_manager_org_ids()))
  );
drop policy if exists academy_agents_ins on academy_agents;
create policy academy_agents_ins on academy_agents for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists academy_agents_upd on academy_agents;
create policy academy_agents_upd on academy_agents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists academy_agents_del on academy_agents;
create policy academy_agents_del on academy_agents for delete to authenticated
  using (user_id = (select auth.uid()));
