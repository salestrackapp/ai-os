-- 062 · Jurídico: biblioteca de cláusulas versionada e demandas com prazo
--
-- ── O que existia ─────────────────────────────────────────────────────────────────────────────
-- Nada. `app_settings` vazia, sem `clause_library`, sem `legal_matters`. As minutas eram ESCRITAS
-- PELA IA a cada geração, a partir de cláusulas soltas que não existiam no banco — então duas
-- minutas do mesmo serviço saíam diferentes, e o segundo contrato era copiar e colar o primeiro.
--
-- ── A base ────────────────────────────────────────────────────────────────────────────────────
-- O contrato Salestrack/IMAGO de 07/07/2026, único assinado e único já negociado de verdade.
-- As 12 cláusulas dele viraram 13 aqui: a 3.6 (mora) foi desmembrada e reescrita conforme decisão
-- do André de 30/07/2026 — multa de 10% e cancelamento provisório após 2 faturas vencidas.
--
-- ── Por que versionar E congelar ──────────────────────────────────────────────────────────────
-- Editar a multa hoje não pode reescrever o que a IMAGO assinou. Duas defesas independentes:
--   · `clausula_versoes` — gatilho guarda toda redação anterior, no banco;
--   · `contrato_clausulas` — congela o TEXTO na assinatura. O contrato carrega a própria cópia e
--     não aponta para a biblioteca.
-- Sem o congelamento, um contrato de julho passaria a "dizer" o que a biblioteca diz em dezembro.

create table if not exists clausulas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  ordem int not null default 0,
  titulo text not null,
  categoria text not null default 'geral',
  texto text not null,
  variaveis text[] not null default '{}',
  obrigatoria boolean not null default true,
  vigente boolean not null default true,
  versao int not null default 1,
  observacao_interna text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cl_categoria_check check (categoria in
    ('objeto','prazo','comercial','manutencao','obrigacoes','propriedade','confidencialidade',
     'lgpd','vigencia','geral','foro'))
);
create index if not exists idx_clausulas_vigentes on clausulas (ordem) where vigente;

create table if not exists clausula_versoes (
  id uuid primary key default gen_random_uuid(),
  clausula_id uuid not null references clausulas(id) on delete cascade,
  versao int not null,
  titulo text not null,
  texto text not null,
  motivo text,
  autor uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (clausula_id, versao)
);

create table if not exists legal_matters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  tipo text not null,
  titulo text not null,
  descricao text,
  status text not null default 'aberta',
  prioridade text not null default 'media',
  prazo date,
  responsavel uuid references auth.users(id),
  resolucao text,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lm_tipo_check check (tipo in
    ('notificacao','cobranca','disputa','adequacao','consulta','aditivo','rescisao')),
  constraint lm_status_check check (status in ('aberta','em_andamento','aguardando_terceiro','concluida','arquivada')),
  constraint lm_prioridade_check check (prioridade in ('baixa','media','alta','critica'))
);
create index if not exists idx_lm_abertas on legal_matters (prazo) where concluida_em is null;
create index if not exists idx_lm_org on legal_matters (org_id);

create table if not exists contrato_clausulas (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  clausula_id uuid not null references clausulas(id),
  versao int not null,
  texto_congelado text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (contract_id, clausula_id)
);
create index if not exists idx_cc_contrato on contrato_clausulas (contract_id, ordem);

alter table clausulas          enable row level security;
alter table clausula_versoes   enable row level security;
alter table legal_matters      enable row level security;
alter table contrato_clausulas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clausulas','clausula_versoes','legal_matters'] loop
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

-- O cliente lê as cláusulas do PRÓPRIO contrato: é o documento dele.
drop policy if exists contrato_clausulas_select on contrato_clausulas;
drop policy if exists contrato_clausulas_ins on contrato_clausulas;
drop policy if exists contrato_clausulas_upd on contrato_clausulas;
drop policy if exists contrato_clausulas_del on contrato_clausulas;
create policy contrato_clausulas_select on contrato_clausulas for select
  using (is_salestrack_admin() or contract_id in (
    select id from contracts where org_id in (select user_org_ids())));
create policy contrato_clausulas_ins on contrato_clausulas for insert with check (is_salestrack_admin());
create policy contrato_clausulas_upd on contrato_clausulas for update using (is_salestrack_admin()) with check (is_salestrack_admin());
create policy contrato_clausulas_del on contrato_clausulas for delete using (is_salestrack_admin());

create or replace function fn_clausula_versiona()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.texto is distinct from old.texto or new.titulo is distinct from old.titulo then
    insert into clausula_versoes (clausula_id, versao, titulo, texto, motivo)
    values (old.id, old.versao, old.titulo, old.texto, new.observacao_interna);
    new.versao := old.versao + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_clausula_versiona on clausulas;
create trigger trg_clausula_versiona
  before update on clausulas
  for each row execute function fn_clausula_versiona();

-- ── Regra de mora por CONTRATO, não global ───────────────────────────────────────────────────
-- A regra vigente é 10%, mas o contrato da IMAGO pactuou 2% e a cláusula 11.5 dele exige termo
-- aditivo para mudar. Cobrar 10% de quem assinou 2% é cobrança indevida.
--
-- NOTA: a primeira versão desta migration ia gravar a multa nos contratos JÁ ASSINADOS, e o
-- gatilho `fn_lock_approved` recusou — corretamente. Por isso a regra vive na FATURA, que é onde
-- é aplicada, como cópia e não join: a fatura diz sozinha por qual regra foi cobrada.
alter table contracts add column if not exists multa_pactuada numeric(5,4) not null default 0.10;
alter table contracts add column if not exists juros_mes_pactuado numeric(5,4) not null default 0.01;
alter table contracts add column if not exists faturas_para_suspender int not null default 2;
alter table contracts add column if not exists dias_para_suspender int;
alter table invoices  add column if not exists multa_pactuada numeric(5,4);

update invoices i set multa_pactuada = 0.02
  from contracts c
 where i.contract_id = c.id and c.signed_at is not null and c.signed_at < '2026-07-30'
   and i.multa_pactuada is null;
update invoices set multa_pactuada = 0.10 where multa_pactuada is null;
