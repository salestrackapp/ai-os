-- 058 · Coleta externa no LinkedIn (raspagem via Apify)
--
-- ── O que isto é, dito sem eufemismo ─────────────────────────────────────────────────────────
-- Raspagem. Contraria os termos de uso do LinkedIn e pode custar a conta usada, que é a pessoal
-- do André. A decisão de assumir esse risco é dele, tomada em 2026-07-30 depois de a alternativa
-- licenciada (Apollo + reações aos posts próprios) estar construída e funcionando.
--
-- O LIA foi REFEITO por causa disso (docs/LIA_PROSPECCAO.md, versão 2): a versão 1 concluía que o
-- interesse legítimo prevalecia *porque* a fonte era licenciada. Essa premissa caiu, e a conclusão
-- foi reexaminada em vez de herdada.
--
-- ── Por que os tetos vivem no BANCO ──────────────────────────────────────────────────────────
-- Constraint no schema, não constante no código: um teto em código se muda num commit distraído;
-- um check constraint recusa o valor absurdo em qualquer caminho de escrita. `pausa_min_ms >= 1000`
-- existe porque ritmo sem pausa é assinatura de robô, e é o primeiro padrão que um antifraude
-- procura.

create table if not exists coleta_externa_config (
  id text primary key default 'unica',
  provedor text not null default 'apify',
  ativo boolean not null default false,
  -- IDs dos actors, um por escopo. Configuráveis porque o mercado de actors muda: o que funciona
  -- hoje pode ser descontinuado, e trocar precisa ser mudar um campo, não fazer deploy.
  actor_atividade text,
  actor_reacoes_post text,
  actor_perfil text,
  -- Actors que leem só conteúdo público não usam a sessão — e aí nenhuma conta corre risco.
  -- A escolha fica explícita aqui em vez de embutida no código.
  usa_cookie boolean not null default false,
  teto_execucoes_dia int not null default 5,
  teto_perfis_execucao int not null default 25,
  pausa_min_ms int not null default 4000,
  pausa_max_ms int not null default 11000,
  parado_ate timestamptz,
  motivo_parada text,
  updated_at timestamptz not null default now(),
  constraint ce_tetos_check check (teto_execucoes_dia between 0 and 50 and teto_perfis_execucao between 1 and 200),
  constraint ce_pausa_check check (pausa_min_ms >= 1000 and pausa_max_ms > pausa_min_ms)
);
insert into coleta_externa_config (id) values ('unica') on conflict (id) do nothing;

-- Cada linha custou dinheiro E exposição. O histórico existe para dar para conferir se rendeu.
create table if not exists coleta_externa_execucoes (
  id uuid primary key default gen_random_uuid(),
  escopo text not null,
  alvo text,
  run_id text,
  status text not null default 'rodando',
  itens int not null default 0,
  casados int not null default 0,
  novos int not null default 0,
  custo_usd numeric(10,4),
  erro text,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  constraint cee_escopo_check check (escopo in ('atividade_perfil','reacoes_post','posts_proprios','grupos')),
  constraint cee_status_check check (status in ('rodando','concluida','falhou','bloqueada'))
);
create index if not exists idx_cee_recente on coleta_externa_execucoes (iniciada_em desc);

-- Fontes: perfis e páginas que publicam sobre IA. Varrer quem reagiu a UM post rende dezenas de
-- pessoas numa requisição, contra uma pessoa por requisição na varredura perfil a perfil. Menos
-- requisições significa menos exposição E menos dado pessoal tocado — é o que mantém o
-- tratamento proporcional à finalidade.
create table if not exists linkedin_fontes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'perfil',
  nome text not null,
  url text not null,
  ativa boolean not null default true,
  ultima_coleta timestamptz,
  total_pessoas int not null default 0,
  created_at timestamptz not null default now(),
  constraint lf_tipo_check check (tipo in ('perfil','pagina','grupo','hashtag')),
  unique (url)
);

alter table linkedin_interacoes add column if not exists origem_externa text;
alter table linkedin_interacoes add column if not exists fonte_id uuid references linkedin_fontes(id) on delete set null;
alter table linkedin_interacoes drop constraint if exists li_tipo_check;
alter table linkedin_interacoes add constraint li_tipo_check check (tipo in (
  'curtida','comentario','compartilhamento','post_proprio','mencao','grupo'
));
-- Interação em post de TERCEIRO não tem post nosso por trás.
alter table linkedin_interacoes alter column post_id drop not null;

alter table coleta_externa_config    enable row level security;
alter table coleta_externa_execucoes enable row level security;
alter table linkedin_fontes          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['coleta_externa_config','coleta_externa_execucoes','linkedin_fontes'] loop
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    execute format('create policy %I_select on %I for select using (is_salestrack_admin())', t, t);
    execute format('create policy %I_ins on %I for insert with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_upd on %I for update using (is_salestrack_admin()) with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_del on %I for delete using (is_salestrack_admin())', t, t);
  end loop;
end $$;
