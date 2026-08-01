-- 071 · Registro de operações de tratamento (LGPD art. 37) e os operadores que recebem dado
--
-- ── Por que isto existe ──────────────────────────────────────────────────────────────────────
-- O art. 37 obriga o controlador a manter registro das operações de tratamento. Não é papelada:
-- é o documento que a ANPD pede primeiro numa fiscalização, e é o que a diligência de um cliente
-- corporativo pede antes de assinar. Até aqui a Salestrack não tinha nenhum — o que o sistema
-- trata estava distribuído entre o schema, os comentários do código e a cabeça de quem escreveu.
--
-- ── Por que no banco, e não num documento ────────────────────────────────────────────────────
-- Um registro em documento nasce certo e envelhece errado: alguém liga uma integração nova, e o
-- .docx continua descrevendo o sistema de seis meses atrás. No banco ele tem tela, tem edição
-- auditada, e — o que importa mais — a política de privacidade PÚBLICA passa a ser renderizada
-- daqui. Uma fonte só para o que dizemos por dentro e o que dizemos por fora.
--
-- Divergir entre os dois é exatamente a infração: prometer no site uma coisa e tratar outra. Com
-- um registro só, a divergência deixa de ser possível por esquecimento.

create table if not exists tratamento_operacoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null,                       -- estável, usada pelo seed e pelos links da política
  ordem integer not null default 100,
  ativo boolean not null default true,

  nome text not null,                        -- "Prospecção B2B", "Newsletter"
  finalidade text not null,                  -- para que o dado é usado, em linguagem de gente
  base_legal text not null,
  titulares text not null,                   -- de quem são os dados
  dados text not null,                       -- que categorias
  origem text not null,                      -- de onde vem
  compartilhamento text,                     -- quem mais vê, além da Salestrack
  retencao text not null,                    -- por quanto tempo, e o que encerra
  -- Onde a operação mora no sistema. Não vai para a página pública: serve a quem for auditar, e é
  -- o que permite conferir a linha contra o código em vez de acreditar nela.
  onde_no_sistema text,
  observacao text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tratamento_operacoes_base_check check (base_legal in (
    'consentimento','execucao_contrato','legitimo_interesse','obrigacao_legal',
    'exercicio_direitos','protecao_credito','procedimento_preliminar'
  ))
);

create unique index if not exists uq_tratamento_operacoes_chave on tratamento_operacoes (chave);
create index if not exists idx_tratamento_operacoes_ordem on tratamento_operacoes (ordem) where ativo;

-- ── Operadores ────────────────────────────────────────────────────────────────────────────────
-- Terceiros que tratam dado pessoal por conta da Salestrack (art. 5º, VII). Tabela própria porque
-- a lista muda por motivo diferente da lista de operações: liga-se uma integração nova sem que a
-- finalidade mude, e desliga-se um fornecedor sem que a operação acabe.
--
-- `pais` não é enfeite: transferência internacional tem regime próprio (arts. 33-36), e metade
-- desta lista está fora do Brasil. Quem lê a política tem direito de saber para onde o dado vai.
create table if not exists tratamento_operadores (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  ordem integer not null default 100,
  ativo boolean not null default true,

  nome text not null,
  papel text not null,                       -- "envio de e-mail", "hospedagem do banco"
  dados text not null,                       -- que categorias chegam lá
  pais text not null,                        -- 'Brasil' ou o país de destino
  site text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_tratamento_operadores_chave on tratamento_operadores (chave);
create index if not exists idx_tratamento_operadores_ordem on tratamento_operadores (ordem) where ativo;

alter table tratamento_operacoes enable row level security;
alter table tratamento_operadores enable row level security;

/*
 * Leitura liberada para `anon`, e isto é deliberado.
 *
 * É o conteúdo da política de privacidade — feito para ser público. Fechá-lo obrigaria a página
 * pública a usar service role, que é uma chave com poder de ler tudo, para exibir o texto que
 * qualquer um pode ler de qualquer jeito. Escrita continua só de admin.
 */
drop policy if exists tratamento_operacoes_sel on tratamento_operacoes;
create policy tratamento_operacoes_sel on tratamento_operacoes for select to anon, authenticated using (ativo);
drop policy if exists tratamento_operacoes_ins on tratamento_operacoes;
create policy tratamento_operacoes_ins on tratamento_operacoes for insert to authenticated with check (is_salestrack_admin());
drop policy if exists tratamento_operacoes_upd on tratamento_operacoes;
create policy tratamento_operacoes_upd on tratamento_operacoes for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists tratamento_operacoes_del on tratamento_operacoes;
create policy tratamento_operacoes_del on tratamento_operacoes for delete to authenticated using (is_salestrack_admin());

drop policy if exists tratamento_operadores_sel on tratamento_operadores;
create policy tratamento_operadores_sel on tratamento_operadores for select to anon, authenticated using (ativo);
drop policy if exists tratamento_operadores_ins on tratamento_operadores;
create policy tratamento_operadores_ins on tratamento_operadores for insert to authenticated with check (is_salestrack_admin());
drop policy if exists tratamento_operadores_upd on tratamento_operadores;
create policy tratamento_operadores_upd on tratamento_operadores for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists tratamento_operadores_del on tratamento_operadores;
create policy tratamento_operadores_del on tratamento_operadores for delete to authenticated using (is_salestrack_admin());

comment on table tratamento_operacoes is
  'Registro das operações de tratamento (LGPD art. 37). A política de privacidade pública é renderizada daqui — não há segunda fonte.';
comment on table tratamento_operadores is
  'Terceiros que tratam dado pessoal por conta da Salestrack, com o país de cada um (transferência internacional, arts. 33-36).';
