-- RH · 001 · Pessoal
--
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- ESTE ARQUIVO RODA NO PROJETO SUPABASE `salestrack-rh` (tsuejfuwpxqydtkwtwqd, sa-east-1).
-- NÃO é o banco do AI OS. A separação física é o ponto: uma falha de política no sistema
-- principal não alcança dados de pessoal.
-- ══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── Por que este banco é diferente de todos os outros ─────────────────────────────────────────
-- Aqui moram CPF, salário, avaliação de desempenho e afastamento médico. Os três primeiros são
-- dados pessoais comuns tratados num contexto de assimetria (empregador × empregado); o último é
-- dado **sensível** (art. 5º, II da LGPD), com regime jurídico próprio.
--
-- Três decisões que não valem no resto do sistema e valem aqui:
--
--  1. **CPF e salário são criptografados em repouso** (`pgcrypto`), não só protegidos por RLS.
--     RLS defende contra consulta indevida; criptografia defende contra vazamento de dump, que é
--     como esse tipo de dado costuma sair de uma empresa.
--
--  2. **O motivo do afastamento é separado do afastamento.** Saber que alguém esteve afastado é
--     informação de gestão; saber o diagnóstico é dado de saúde. Ficam em tabelas distintas, com
--     acessos distintos, para que uma consulta de gestão nunca traga a segunda por tabela junta.
--
--  3. **Leitura de dado sensível é auditada.** No resto do sistema auditamos escrita; aqui,
--     também quem LEU. Consultar a ficha médica de um colega sem motivo é o abuso típico, e ele
--     não deixa rastro nenhum num modelo que só audita escrita.

create extension if not exists pgcrypto with schema extensions;

-- ── Papéis internos ───────────────────────────────────────────────────────────────────────────
-- Deliberadamente separados dos 5 papéis do AI OS (`salestrack_admin`, `sponsor`, `gestor_frente`,
-- `colaborador`, `financeiro`). Aqueles descrevem a hierarquia de um CLIENTE; estes, a da própria
-- Salestrack. Reusá-los faria um `gestor_frente` de cliente herdar acesso a folha de pagamento.
create table if not exists rh_papeis (
  user_id uuid primary key,                 -- auth.users do PROJETO DE RH, não o do AI OS
  email text not null,
  papel text not null,
  ativo boolean not null default true,
  concedido_por uuid,
  concedido_em timestamptz not null default now(),
  constraint rh_papel_check check (papel in ('rh_admin','rh_gestor','rh_leitura'))
);
comment on table rh_papeis is
  'Quem pode o quê no RH. rh_admin: tudo. rh_gestor: lê o time e registra ausência. rh_leitura: só agregados, sem dado individual.';

create or replace function rh_papel()
returns text language sql stable
security definer
set search_path = public, pg_temp
as $$
  select papel from rh_papeis where user_id = (select auth.uid()) and ativo limit 1;
$$;
revoke execute on function rh_papel() from public;
grant execute on function rh_papel() to authenticated;

create or replace function eh_rh_admin()
returns boolean language sql stable
security definer
set search_path = public, pg_temp
as $$ select coalesce(rh_papel() = 'rh_admin', false); $$;
revoke execute on function eh_rh_admin() from public;
grant execute on function eh_rh_admin() to authenticated;

-- ── Pessoas ───────────────────────────────────────────────────────────────────────────────────
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email_corporativo text unique,
  -- CPF cifrado. A busca por CPF usa o hash; o valor só é decifrado quando alguém precisa VER,
  -- e essa leitura é auditada.
  cpf_cifrado bytea,
  cpf_hash text unique,
  data_nascimento date,
  cargo text,
  departamento text,
  gestor_id uuid references employees(id) on delete set null,
  regime text not null default 'clt',
  admissao date not null,
  desligamento date,
  motivo_desligamento text,
  ativo boolean generated always as (desligamento is null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emp_regime_check check (regime in ('clt','pj','estagio','aprendiz','socio')),
  constraint emp_datas_check check (desligamento is null or desligamento >= admissao)
);
create index if not exists idx_emp_ativos on employees (nome) where desligamento is null;
create index if not exists idx_emp_gestor on employees (gestor_id);

-- ── Remuneração ───────────────────────────────────────────────────────────────────────────────
-- Histórico, não coluna: o salário de hoje não apaga o de ontem, e a progressão é o dado que
-- sustenta conversa de mérito e defesa em reclamatória.
create table if not exists employee_remuneracao (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  valor_cifrado bytea not null,
  moeda text not null default 'BRL',
  tipo text not null default 'salario',
  vigencia_inicio date not null,
  vigencia_fim date,
  motivo text,
  registrado_por uuid,
  created_at timestamptz not null default now(),
  constraint rem_tipo_check check (tipo in ('salario','bonus','comissao','ajuda_custo','pro_labore'))
);
create index if not exists idx_rem_emp on employee_remuneracao (employee_id, vigencia_inicio desc);

-- ── Ausências ─────────────────────────────────────────────────────────────────────────────────
-- Sem motivo médico aqui. Quantos dias alguém esteve fora é gestão; POR QUE é saúde.
create table if not exists ausencias (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  tipo text not null,
  inicio date not null,
  fim date not null,
  dias int generated always as ((fim - inicio) + 1) stored,
  status text not null default 'solicitada',
  observacao text,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint aus_tipo_check check (tipo in ('ferias','licenca','falta','afastamento','folga','home_office')),
  constraint aus_status_check check (status in ('solicitada','aprovada','recusada','cancelada')),
  constraint aus_datas_check check (fim >= inicio)
);
create index if not exists idx_aus_emp on ausencias (employee_id, inicio desc);
create index if not exists idx_aus_periodo on ausencias (inicio, fim) where status = 'aprovada';

-- Dado de saúde, isolado. Só `rh_admin` alcança, e toda leitura fica registrada.
create table if not exists ausencia_saude (
  ausencia_id uuid primary key references ausencias(id) on delete cascade,
  cid text,
  descricao_cifrada bytea,
  atestado_url text,
  created_at timestamptz not null default now()
);
comment on table ausencia_saude is
  'DADO SENSÍVEL (LGPD art. 5º, II). Separado de `ausencias` de propósito: consulta de gestão não pode trazer diagnóstico por tabela junta. Só rh_admin lê, e a leitura é auditada.';

-- ── Avaliações ────────────────────────────────────────────────────────────────────────────────
create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  ciclo text not null,
  avaliador_id uuid references employees(id) on delete set null,
  nota numeric(3,1),
  pontos_fortes text,
  pontos_desenvolver text,
  plano_acao text,
  visivel_ao_avaliado boolean not null default false,
  fechada_em timestamptz,
  created_at timestamptz not null default now(),
  constraint av_nota_check check (nota is null or (nota >= 0 and nota <= 10)),
  unique (employee_id, ciclo)
);
comment on column avaliacoes.visivel_ao_avaliado is
  'Avaliação em rascunho não é visível ao avaliado. Quem descobre a própria nota antes da conversa recebe o pior formato possível de um feedback difícil.';

-- ── Auditoria, inclusive de LEITURA ───────────────────────────────────────────────────────────
create table if not exists rh_audit (
  id uuid primary key default gen_random_uuid(),
  ator uuid,
  acao text not null,
  recurso text not null,
  recurso_id uuid,
  employee_id uuid,
  detalhe jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_rh_audit_recente on rh_audit (created_at desc);
create index if not exists idx_rh_audit_emp on rh_audit (employee_id, created_at desc);

-- Insert-only, como no AI OS: trilha que pode ser editada não é trilha.
revoke update, delete on rh_audit from anon, authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────────────────────
alter table rh_papeis             enable row level security;
alter table employees             enable row level security;
alter table employee_remuneracao  enable row level security;
alter table ausencias             enable row level security;
alter table ausencia_saude        enable row level security;
alter table avaliacoes            enable row level security;
alter table rh_audit              enable row level security;

-- Quem sou eu, como employee. Liga o login à ficha, para as políticas "vê o próprio".
create or replace function meu_employee_id()
returns uuid language sql stable
security definer
set search_path = public, pg_temp
as $$
  select e.id from employees e
  join rh_papeis p on lower(p.email) = lower(e.email_corporativo)
  where p.user_id = (select auth.uid()) limit 1;
$$;
revoke execute on function meu_employee_id() from public;
grant execute on function meu_employee_id() to authenticated;

-- rh_papeis: só admin administra; cada um enxerga o próprio papel.
drop policy if exists rh_papeis_select on rh_papeis;
create policy rh_papeis_select on rh_papeis for select
  using (eh_rh_admin() or user_id = (select auth.uid()));
drop policy if exists rh_papeis_admin on rh_papeis;
create policy rh_papeis_admin on rh_papeis for all
  using (eh_rh_admin()) with check (eh_rh_admin());

-- employees: admin vê todos; gestor vê o próprio time; cada um vê a si.
drop policy if exists employees_select on employees;
create policy employees_select on employees for select
  using (
    eh_rh_admin()
    or id = meu_employee_id()
    or (rh_papel() = 'rh_gestor' and gestor_id = meu_employee_id())
  );
drop policy if exists employees_write on employees;
create policy employees_write on employees for all
  using (eh_rh_admin()) with check (eh_rh_admin());

-- Remuneração: só admin, e só o próprio. Gestor NÃO vê salário do time — é a informação que mais
-- vaza lateralmente numa empresa, e ver o do time não é necessário para gerir o time.
drop policy if exists remuneracao_select on employee_remuneracao;
create policy remuneracao_select on employee_remuneracao for select
  using (eh_rh_admin() or employee_id = meu_employee_id());
drop policy if exists remuneracao_write on employee_remuneracao;
create policy remuneracao_write on employee_remuneracao for all
  using (eh_rh_admin()) with check (eh_rh_admin());

-- Ausências: admin tudo; gestor as do time (para planejar); cada um as suas.
drop policy if exists ausencias_select on ausencias;
create policy ausencias_select on ausencias for select
  using (
    eh_rh_admin()
    or employee_id = meu_employee_id()
    or (rh_papel() = 'rh_gestor'
        and employee_id in (select id from employees where gestor_id = meu_employee_id()))
  );
drop policy if exists ausencias_insert on ausencias;
create policy ausencias_insert on ausencias for insert
  with check (eh_rh_admin() or employee_id = meu_employee_id());
drop policy if exists ausencias_update on ausencias;
create policy ausencias_update on ausencias for update
  using (eh_rh_admin() or (rh_papel() = 'rh_gestor'
        and employee_id in (select id from employees where gestor_id = meu_employee_id())))
  with check (eh_rh_admin() or rh_papel() = 'rh_gestor');
drop policy if exists ausencias_delete on ausencias;
create policy ausencias_delete on ausencias for delete using (eh_rh_admin());

-- Saúde: SÓ admin. Nem o gestor, nem o próprio por esta via — o próprio pede ao RH, que registra
-- a entrega. Dar leitura direta ao titular aqui abriria o mesmo caminho para o gestor por engano
-- numa política futura.
drop policy if exists saude_admin on ausencia_saude;
create policy saude_admin on ausencia_saude for all
  using (eh_rh_admin()) with check (eh_rh_admin());

-- Avaliações: admin tudo; avaliado vê a sua SÓ depois de fechada e liberada.
drop policy if exists avaliacoes_select on avaliacoes;
create policy avaliacoes_select on avaliacoes for select
  using (
    eh_rh_admin()
    or (employee_id = meu_employee_id() and visivel_ao_avaliado and fechada_em is not null)
    or avaliador_id = meu_employee_id()
  );
drop policy if exists avaliacoes_write on avaliacoes;
create policy avaliacoes_write on avaliacoes for all
  using (eh_rh_admin() or avaliador_id = meu_employee_id())
  with check (eh_rh_admin() or avaliador_id = meu_employee_id());

-- Auditoria: admin lê; ninguém edita.
drop policy if exists rh_audit_select on rh_audit;
create policy rh_audit_select on rh_audit for select using (eh_rh_admin());
drop policy if exists rh_audit_insert on rh_audit;
create policy rh_audit_insert on rh_audit for insert with check (true);

-- ── Cifra e decifra ───────────────────────────────────────────────────────────────────────────
-- A chave vem de um GUC de sessão (`app.rh_key`), definido pelo servidor a cada conexão. Nunca
-- fica no schema: quem obtiver um dump não obtém a chave junto.
create or replace function rh_cifrar(p_texto text)
returns bytea language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare chave text := current_setting('app.rh_key', true);
begin
  if p_texto is null or p_texto = '' then return null; end if;
  if chave is null or chave = '' then
    raise exception 'Chave de cifra do RH não configurada nesta sessão.';
  end if;
  return pgp_sym_encrypt(p_texto, chave);
end $$;

create or replace function rh_decifrar(p_dado bytea)
returns text language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare chave text := current_setting('app.rh_key', true);
begin
  if p_dado is null then return null; end if;
  if chave is null or chave = '' then
    raise exception 'Chave de cifra do RH não configurada nesta sessão.';
  end if;
  return pgp_sym_decrypt(p_dado, chave);
exception when others then
  return null;   -- chave errada não derruba a consulta inteira; devolve nulo e segue
end $$;

revoke execute on function rh_cifrar(text), rh_decifrar(bytea) from public, anon;
grant execute on function rh_cifrar(text), rh_decifrar(bytea) to authenticated;

-- Hash do CPF para busca sem decifrar. Com sal fixo do ambiente: sem ele, o espaço de CPF é
-- pequeno o bastante para ser varrido por força bruta a partir do hash.
create or replace function rh_hash_cpf(p_cpf text)
returns text language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare sal text := coalesce(current_setting('app.rh_salt', true), '');
begin
  if p_cpf is null or p_cpf = '' then return null; end if;
  if sal = '' then raise exception 'Sal do RH não configurado nesta sessão.'; end if;
  return encode(digest(regexp_replace(p_cpf, '\D', '', 'g') || sal, 'sha256'), 'hex');
end $$;
revoke execute on function rh_hash_cpf(text) from public, anon;
grant execute on function rh_hash_cpf(text) to authenticated;
