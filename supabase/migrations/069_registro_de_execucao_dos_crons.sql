-- 069 · Registro de execução dos crons
--
-- Um job diário quebrado e um job diário correto que não encontrou trabalho produzem o MESMO
-- silêncio. Sem uma linha dizendo "rodei às 5h e não havia nada", a única forma de descobrir que
-- um cron parou é sentir falta do resultado — o que acontece semanas depois. A linha é escrita
-- sempre, inclusive na rodada vazia; é ela que separa "não achou nada" de "parou de rodar".
--
-- Só o service role escreve (a casca `comRegistro` em lib/ops/cron.ts). Não há policy de insert
-- para `authenticated` de propósito: se qualquer sessão pudesse gravar, a tabela de saúde poderia
-- ser preenchida com rodadas que nunca aconteceram, e ela deixaria de provar coisa alguma.

create table if not exists public.cron_execucoes (
  id           uuid primary key default gen_random_uuid(),
  nome         text        not null,
  iniciado_em  timestamptz not null default now(),
  duracao_ms   integer,
  ok           boolean     not null default true,
  resumo       jsonb       not null default '{}'::jsonb,
  erro         text,
  created_at   timestamptz not null default now()
);

-- A consulta da tela é sempre "a última rodada de cada nome".
create index if not exists idx_cron_execucoes_nome on public.cron_execucoes (nome, iniciado_em desc);
-- Índice parcial só das falhas: a varredura de problemas não paga o custo das rodadas boas.
create index if not exists idx_cron_execucoes_falhas on public.cron_execucoes (iniciado_em desc) where not ok;

alter table public.cron_execucoes enable row level security;

drop policy if exists cron_execucoes_sel on public.cron_execucoes;
create policy cron_execucoes_sel on public.cron_execucoes
  for select to authenticated
  using (is_salestrack_admin());
