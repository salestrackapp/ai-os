-- 056 · Buscas automáticas de prospecção (coleta pelo Apollo)
--
-- A coleta usa fonte LICENCIADA (Apollo), não raspagem de perfis com a conta do André. Isso não é
-- detalhe de implementação: raspar contraria os termos da plataforma e conta bloqueada não volta.
-- Era o "plano B" do §8 do plano mestre; virou o plano A, e o risco contratual sai do desenho.
--
-- `meta_por_execucao` e `teto_enriquecimento` existem porque a coleta GASTA DINHEIRO: cada e-mail
-- descoberto consome crédito pago. Uma busca ampla sem teto queima a conta numa madrugada.
--
-- `ultima_pagina` é o que faz a coleta AVANÇAR. Sem guardar onde parou, toda execução traria as
-- mesmas 25 pessoas e a base nunca cresceria.

create table if not exists prospect_buscas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  icp text,
  cargos text[] not null default '{}',
  senioridades text[] not null default '{}',
  setores text[] not null default '{}',
  locais text[] not null default '{}',
  porte text[] not null default '{}',
  palavras_chave text,
  ativa boolean not null default true,
  meta_por_execucao int not null default 25,
  teto_enriquecimento int not null default 25,
  campaign_id uuid references campaigns(id),
  ultima_execucao timestamptz,
  ultima_pagina int not null default 0,
  total_coletado int not null default 0,
  ultimo_erro text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pb_meta_check check (meta_por_execucao between 1 and 200),
  constraint pb_teto_check check (teto_enriquecimento between 0 and 200)
);
create index if not exists idx_pb_ativa on prospect_buscas (ativa) where deleted_at is null;

-- Histórico por execução: é o que mostra quanto crédito foi gasto e quanto rendeu. Um cron caro
-- rodando em silêncio é um cron que ninguém percebe quando começa a queimar dinheiro à toa.
create table if not exists prospect_busca_execucoes (
  id uuid primary key default gen_random_uuid(),
  busca_id uuid not null references prospect_buscas(id) on delete cascade,
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  vistos int not null default 0,
  criados int not null default 0,
  duplicados int not null default 0,
  recusados_pessoal int not null default 0,
  enriquecidos int not null default 0,
  erro text
);
create index if not exists idx_pbe_busca on prospect_busca_execucoes (busca_id, iniciada_em desc);

alter table prospect_buscas enable row level security;
alter table prospect_busca_execucoes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['prospect_buscas','prospect_busca_execucoes'] loop
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

-- De qual busca cada pessoa veio. É o registro do POR QUE ela está na base — parte da
-- demonstração de conformidade, e o motivo de a busca ser arquivada em vez de apagada.
alter table prospects add column if not exists busca_id uuid references prospect_buscas(id);
create index if not exists idx_prospects_busca on prospects (busca_id);

alter table prospect_accounts add column if not exists sinais_em timestamptz;
