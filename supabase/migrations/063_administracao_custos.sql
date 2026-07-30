-- 063 · Administração: fornecedores, despesas recorrentes e ativos internos
--
-- ── O que motivou ─────────────────────────────────────────────────────────────────────────────
-- Descobrimos em 2026-07-30 que a Salestrack pagava DOIS projetos Supabase, um deles vazio desde
-- que a academy foi desligada. Ninguém sabia porque nada no sistema acompanhava assinatura de
-- ferramenta. Custo recorrente é o que some da vista: entra uma vez, cobra todo mês, e só aparece
-- na fatura do cartão junto de outros dez.
--
-- Por isso o foco é RECORRÊNCIA, não nota fiscal avulsa. A pergunta que a tela responde é
-- "quanto sai por mês, para quem, e o que disso ainda serve?".
--
-- `revisada_em` é a coluna que faz o trabalho: "isto ainda serve?" é a pergunta que ninguém faz
-- sozinha, e a data força a resposta a aparecer numa tela em vez de virar cobrança perpétua.

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'ferramenta',
  cnpj text,
  site text,
  contato_email text,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_categoria_check check (categoria in
    ('ferramenta','infraestrutura','servico','contabilidade','juridico','marketing','equipamento','outro'))
);
-- Índice único sobre expressão — `unique (lower(nome))` inline não é aceito na definição da tabela.
create unique index if not exists uq_vendor_nome on vendors (lower(nome));

create table if not exists despesas (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete set null,
  descricao text not null,
  valor_centavos int not null,
  moeda text not null default 'BRL',
  recorrencia text not null default 'mensal',
  categoria text not null default 'ferramenta',
  inicio date not null,
  fim date,
  dia_cobranca int,
  revisada_em date,
  responsavel uuid references auth.users(id),
  observacao text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint desp_recorrencia_check check (recorrencia in ('unica','mensal','anual','trimestral')),
  constraint desp_categoria_check check (categoria in
    ('ferramenta','infraestrutura','servico','contabilidade','juridico','marketing','equipamento','imposto','outro')),
  constraint desp_valor_check check (valor_centavos > 0),
  constraint desp_dia_check check (dia_cobranca is null or dia_cobranca between 1 and 31)
);
create index if not exists idx_desp_ativas on despesas (categoria) where ativa;
create index if not exists idx_desp_vendor on despesas (vendor_id);
create index if not exists idx_desp_revisao on despesas (revisada_em) where ativa;

create table if not exists internal_assets (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'equipamento',
  identificador text,
  com_quem text,
  valor_centavos int,
  aquisicao date,
  baixa date,
  observacao text,
  created_at timestamptz not null default now(),
  constraint asset_tipo_check check (tipo in ('equipamento','licenca','dominio','movel','outro'))
);
create index if not exists idx_assets_ativos on internal_assets (tipo) where baixa is null;

alter table vendors         enable row level security;
alter table despesas        enable row level security;
alter table internal_assets enable row level security;

-- Interna da Salestrack: cliente nenhum vê o que a empresa gasta.
do $$
declare t text;
begin
  foreach t in array array['vendors','despesas','internal_assets'] loop
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

-- Custo mensal equivalente: anual /12, trimestral /3, única fora da recorrência. Sem essa
-- normalização, comparar uma assinatura anual com uma mensal exige conta de cabeça — e é assim
-- que o custo anual grande passa despercebido ao lado de mensalidades pequenas.
create or replace function fn_custo_mensal(p_valor int, p_recorrencia text)
returns int language sql immutable
set search_path = public, pg_temp
as $$
  select case p_recorrencia
    when 'mensal' then p_valor
    when 'anual' then (p_valor / 12)
    when 'trimestral' then (p_valor / 3)
    else 0
  end;
$$;

create or replace view despesas_recorrentes with (security_invoker = on) as
select d.id, d.descricao, d.categoria, d.recorrencia, d.valor_centavos,
       fn_custo_mensal(d.valor_centavos, d.recorrencia) as custo_mensal_centavos,
       d.inicio, d.revisada_em, d.dia_cobranca, d.ativa,
       v.nome as fornecedor
  from despesas d
  left join vendors v on v.id = d.vendor_id
 where d.ativa and d.recorrencia <> 'unica';
