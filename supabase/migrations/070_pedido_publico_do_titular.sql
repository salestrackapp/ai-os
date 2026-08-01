-- 070 · Pedido público do titular, com prova de identidade
--
-- ── O problema que isto resolve ───────────────────────────────────────────────────────────────
-- `dsr_requests` já existia, mas só um admin conseguia criar linha lá. Os avisos de privacidade
-- publicados mandam o titular escrever para o encarregado — e um e-mail que chega na caixa não
-- vira pedido registrado sozinho. Resultado: o prazo legal de 15 dias (art. 19, II) só começava a
-- contar quando alguém lembrasse de transcrever o e-mail à mão. Um pedido esquecido na caixa é
-- indistinguível de um pedido que nunca chegou — o mesmo defeito da fatura vencida invisível.
--
-- ── Por que uma tabela de espera, e não uma linha em `dsr_requests` ───────────────────────────
-- Formulário aberto na internet aceita o e-mail de qualquer pessoa. Um pedido de EXCLUSÃO enviado
-- em nome de terceiro é um ataque, não um pedido — e a LGPD exige que o controlador se certifique
-- de que quem pede é mesmo o titular (art. 18 §5). Por isso a submissão fica aqui, em espera, e só
-- vira linha em `dsr_requests` depois do clique no link que chegou NAQUELA caixa.
--
-- A consequência prática é a que importa: `dsr_requests` continua sendo o livro de conformidade,
-- com pedidos reais e verificados, e o relógio de 15 dias nasce no clique — nunca antes, nunca
-- por algo que um estranho digitou.

create table if not exists dsr_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  email text not null,
  nome text,
  detalhe text,
  origem text not null default 'pagina_publica',
  ip text,
  user_agent text,
  token text not null default encode(gen_random_bytes(24), 'hex'),
  confirmado_em timestamptz,
  -- 3 dias, e não 7 como a newsletter: aqui o prazo legal só começa no clique, então link longo
  -- demais adia a obrigação da Salestrack por vontade de quem pediu.
  expira_em timestamptz not null default (now() + interval '3 days'),
  dsr_request_id uuid references dsr_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Mesmo vocabulário de `dsr_requests.tipo`, e não um paralelo: esta linha vira aquela linha, e
  -- um conjunto que divergisse produziria pedido confirmado que o livro de conformidade recusa.
  constraint dsr_confirmacoes_tipo_check
    check (tipo in ('acesso','exclusao','portabilidade','correcao','oposicao','revogacao'))
);

create index if not exists idx_dsr_confirmacoes_token on dsr_confirmacoes (token);
create index if not exists idx_dsr_confirmacoes_pendentes on dsr_confirmacoes (created_at desc)
  where confirmado_em is null;

alter table dsr_confirmacoes enable row level security;

/*
 * Nenhuma policy para `anon`, diferente de `newsletter_inscricoes`.
 *
 * Lá o insert anônimo era aceitável porque a linha não revela nada e não decide nada. Aqui a linha
 * diz "esta pessoa pediu para ser apagada" — é dado sobre o exercício de um direito, e a própria
 * existência dela é informação sensível. Toda escrita passa pelo service role, atrás do limite de
 * taxa da Server Action; o navegador nunca fala com esta tabela.
 */
drop policy if exists dsr_confirmacoes_sel_admin on dsr_confirmacoes;
create policy dsr_confirmacoes_sel_admin on dsr_confirmacoes
  for select to authenticated using (is_salestrack_admin());

-- `dsr_requests` ganha a procedência: pedido aberto pelo próprio titular na página pública é
-- prova mais forte do que pedido transcrito pela equipe, e a diferença precisa sobreviver na
-- linha — não na memória de quem registrou.
alter table dsr_requests add column if not exists origem text;
alter table dsr_requests add column if not exists ip text;
alter table dsr_requests add column if not exists user_agent text;

-- A varredura de prazo procura sempre "aberto e vencendo". Índice parcial: pedido já respondido
-- (concluído ou recusado) não entra na conta e não paga o custo.
create index if not exists idx_dsr_abertos on dsr_requests (prazo_em)
  where status in ('recebido','em_analise');

comment on table dsr_confirmacoes is
  'Submissões da página pública de direitos do titular, em espera. Só vira pedido em dsr_requests depois do clique de confirmação no e-mail — é o clique que prova que quem pediu é o dono do endereço.';
