-- 057 · Engajamento de primeira parte + sinais de IA vindos do LinkedIn
--
-- O Apollo diz QUEM a pessoa é. Não diz — e não pode dizer — se ela abriu a mensagem, clicou,
-- leu a proposta, ou se curte conteúdo de IA. Esta migration cria a segunda metade: o que a
-- própria interação da pessoa CONOSCO revela.
--
-- ── Por que só posts do próprio André ────────────────────────────────────────────────────────
-- Quem curte um post dele sobre IA declara duas coisas de uma vez: que o tema interessa e que já
-- o conhece. O post é dele, a lista de quem reagiu é dele, e o LinkedIn a mostra para ele — não
-- há termo de uso no caminho nem conta em risco.
--
-- O que NÃO é obtido, e não é limitação de implementação: curtida em post de terceiro
-- (nenhuma API expõe), participação em grupo (idem), mensagem privada (comunicação privada,
-- sem base legal possível).
--
-- ── Decaimento ────────────────────────────────────────────────────────────────────────────────
-- `fn_engajamento_score` aplica meia-vida de 30 dias. Sem isso, quem abriu um e-mail em janeiro
-- apareceria em julho tão "quente" quanto quem clicou ontem, e a fila de abordagem ordenaria por
-- antiguidade em vez de interesse.

create table if not exists engagement_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  tipo text not null,
  -- O peso é gravado JUNTO do tipo: se os pesos forem recalibrados amanhã, o histórico continua
  -- explicando por que aquele prospect tinha o score que tinha na época.
  peso int not null default 0,
  fonte text not null default 'ai-os',
  detalhe jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ee_tipo_check check (tipo in (
    'email_aberto','link_clicado','agenda_aberta','proposta_vista','proposta_secao',
    'proposta_aprovada','respondeu','reuniao_marcada','entregavel_visto','site_visitou',
    'whatsapp_respondeu','descadastrou',
    'curtiu_post_ia','comentou_post_ia','compartilhou_post_ia','publica_sobre_ia',
    'empresa_contrata_ia','empresa_usa_ia'
  )),
  constraint ee_sujeito_check check (prospect_id is not null or contact_id is not null)
);
create index if not exists idx_ee_prospect on engagement_events (prospect_id, occurred_at desc);
create index if not exists idx_ee_contact on engagement_events (contact_id, occurred_at desc);

-- O destino do link fica AQUI, nunca na URL. Um `/r?u=https://…` transformaria o AI OS num
-- redirecionador aberto: qualquer um usaria o nosso domínio para levar alguém a um phishing,
-- emprestando a nossa reputação de remetente. O check de `^https?://` fecha javascript: e data:.
create table if not exists engagement_links (
  token uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  message_id uuid references outreach_messages(id) on delete set null,
  destino text not null,
  rotulo text,
  cliques int not null default 0,
  created_at timestamptz not null default now(),
  constraint el_destino_check check (destino ~* '^https?://')
);
create index if not exists idx_el_prospect on engagement_links (prospect_id);

create table if not exists linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  urn text unique,
  url text,
  titulo text,
  resumo text,
  -- Só post de tema IA gera sinal de afinidade: curtir um post de fim de ano não diz nada sobre
  -- estar dentro do assunto.
  tema_ia boolean not null default true,
  publicado_em timestamptz,
  autor text not null default 'andre_kachan',
  reacoes int not null default 0,
  comentarios int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lp_publicado on linkedin_posts (publicado_em desc);

create table if not exists linkedin_interacoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references linkedin_posts(id) on delete cascade,
  tipo text not null,
  perfil_url text,
  perfil_slug text,
  nome text,
  cargo text,
  empresa text,
  texto text,
  ocorreu_em timestamptz not null default now(),
  prospect_id uuid references prospects(id) on delete set null,
  casado_em timestamptz,
  fonte text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint li_tipo_check check (tipo in ('curtida','comentario','compartilhamento','post_proprio','mencao'))
);
create unique index if not exists uq_li_post_perfil_tipo
  on linkedin_interacoes (post_id, perfil_slug, tipo) where perfil_slug is not null;
create index if not exists idx_li_slug on linkedin_interacoes (perfil_slug);
create index if not exists idx_li_prospect on linkedin_interacoes (prospect_id);
create index if not exists idx_li_sem_casar on linkedin_interacoes (ocorreu_em desc) where prospect_id is null;

alter table engagement_events   enable row level security;
alter table engagement_links    enable row level security;
alter table linkedin_posts      enable row level security;
alter table linkedin_interacoes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['engagement_events','engagement_links','linkedin_posts','linkedin_interacoes'] loop
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

alter table prospects         add column if not exists engajamento int not null default 0;
alter table prospects         add column if not exists ultimo_engajamento_em timestamptz;
alter table prospects         add column if not exists afinidade_ia int not null default 0;
alter table prospect_accounts add column if not exists afinidade_ia int not null default 0;

create or replace function fn_engajamento_score(p_prospect uuid)
returns int language sql stable
set search_path = public, pg_temp
as $$
  select least(100, coalesce(round(sum(
    e.peso * exp(-0.0231 * greatest(0, extract(epoch from (now() - e.occurred_at)) / 86400))
  )), 0))::int
  from engagement_events e
  where e.prospect_id = p_prospect;
$$;

create or replace function fn_engajamento_atualiza()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.prospect_id is not null then
    update prospects
       set engajamento = fn_engajamento_score(new.prospect_id),
           ultimo_engajamento_em = greatest(coalesce(ultimo_engajamento_em, new.occurred_at), new.occurred_at)
     where id = new.prospect_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_engajamento_atualiza on engagement_events;
create trigger trg_engajamento_atualiza
  after insert on engagement_events
  for each row execute function fn_engajamento_atualiza();

-- O slug do perfil é a chave que casa LinkedIn e Apollo: as duas pontas trazem a URL, e só ela
-- identifica a mesma pessoa com segurança. Nome + empresa erra — homônimo existe e empresa muda.
create or replace function fn_linkedin_slug(p_url text)
returns text language sql immutable
set search_path = public, pg_temp
as $$
  select nullif(lower(regexp_replace(
    regexp_replace(coalesce(p_url, ''), '^.*/in/', ''),
    '[/?#].*$', ''
  )), '');
$$;

create index if not exists idx_prospects_li_slug on prospects (fn_linkedin_slug(linkedin_url))
  where linkedin_url is not null;
