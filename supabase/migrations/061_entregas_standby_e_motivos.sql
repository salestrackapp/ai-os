-- 061 · Escopo, entregas, stand-by e motivo de cada status
--
-- ── O buraco ──────────────────────────────────────────────────────────────────────────────────
-- A IMAGO tinha contrato assinado, cinco faturas e jornada em andamento — e o sistema não sabia
-- responder "o que ela comprou, e o que já entregamos?". A proposta está aprovada com `items: []`
-- e `deliverables` estava vazia desde que foi criada.
--
-- Não criei tabela nova: `deliverables` já tinha a estrutura certa (frente, título, prazo, data de
-- entrega, artefato) e nunca fora usada. Duas tabelas para o mesmo conceito é como o sistema ganha
-- dois lugares onde procurar a mesma resposta.
--
-- ── Stand-by: espera do cliente não é atraso da equipe ────────────────────────────────────────
-- A IMAGO está com pagamento em atraso e o projeto parou até que ela pague. Sem este conceito, as
-- entregas apareceriam como atraso NOSSO — atribuindo à equipe uma demora que não é dela e
-- apagando a informação que importa: estamos parados porque não recebemos.
--
-- O relógio para, mas não zera. Ao retomar, os dias parados são somados aos prazos pendentes: o
-- cliente não ganha prazo de graça, e a equipe não carrega atraso alheio. O período fica
-- registrado com motivo e datas — adiar a data apagaria o histórico, e três meses depois a
-- conversa sobre prazo viraria palavra contra palavra.
--
-- ── Motivo de cada mudança ────────────────────────────────────────────────────────────────────
-- Obrigatório ao TRAVAR, opcional nos demais, imposto por gatilho. Entrega travada sem explicação
-- é a que ninguém consegue destravar três semanas depois.

alter table deliverables add column if not exists contract_id uuid references contracts(id) on delete set null;
alter table deliverables add column if not exists origem text not null default 'manual';
alter table deliverables add column if not exists observacao text;
alter table deliverables add column if not exists responsavel uuid references auth.users(id);
alter table deliverables add column if not exists ultimo_motivo text;
alter table deliverables add column if not exists created_at timestamptz not null default now();
alter table deliverables add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deliverables_origem_check') then
    alter table deliverables add constraint deliverables_origem_check
      check (origem in ('manual','contrato','proposta','template'));
  end if;
end $$;

create index if not exists idx_deliverables_org on deliverables (org_id) where deleted_at is null;
create index if not exists idx_deliverables_contrato on deliverables (contract_id) where deleted_at is null;
create index if not exists idx_deliverables_atraso on deliverables (due_date)
  where deleted_at is null and delivered_at is null;

alter table contracts add column if not exists vigencia_inicio date;
alter table contracts add column if not exists vigencia_fim date;
alter table contracts add column if not exists escopo jsonb;

alter table projects add column if not exists standby_desde date;
alter table projects add column if not exists standby_motivo text;
alter table projects add column if not exists standby_dias_acumulados int not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'projects_standby_motivo_check') then
    alter table projects add constraint projects_standby_motivo_check
      check (standby_motivo is null or standby_motivo in
        ('inadimplencia','aguardando_cliente','escopo_em_revisao','pausa_solicitada','outro'));
  end if;
end $$;
create index if not exists idx_projects_standby on projects (standby_desde) where standby_desde is not null;

create table if not exists projeto_standby_periodos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  org_id uuid references organizations(id),
  motivo text not null,
  observacao text,
  inicio date not null,
  fim date,
  dias int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint psp_motivo_check check (motivo in
    ('inadimplencia','aguardando_cliente','escopo_em_revisao','pausa_solicitada','outro'))
);
create index if not exists idx_psp_projeto on projeto_standby_periodos (project_id, inicio desc);
create index if not exists idx_psp_aberto on projeto_standby_periodos (project_id) where fim is null;

create table if not exists deliverable_eventos (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  org_id uuid references organizations(id),
  de text,
  para text not null,
  motivo text,
  autor uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_de_entrega on deliverable_eventos (deliverable_id, created_at desc);

create or replace function fn_entrega_evento_exige_motivo()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.para = 'bloqueado' and coalesce(btrim(new.motivo), '') = '' then
    raise exception 'Para travar uma entrega é preciso dizer o motivo — sem ele, ninguém consegue destravar depois.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_entrega_evento_exige_motivo on deliverable_eventos;
create trigger trg_entrega_evento_exige_motivo
  before insert on deliverable_eventos
  for each row execute function fn_entrega_evento_exige_motivo();

alter table deliverables             enable row level security;
alter table projeto_standby_periodos enable row level security;
alter table deliverable_eventos      enable row level security;

-- O CLIENTE lê as três: o que contratou, por que travou e por que o projeto parou. Esconder isso
-- transforma toda pergunta dele numa ligação — e o faz descobrir na cobrança, que é a pior hora.
do $$
declare t text;
begin
  foreach t in array array['deliverables','projeto_standby_periodos','deliverable_eventos'] loop
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('drop policy if exists %I_ins on %I', t, t);
    execute format('drop policy if exists %I_upd on %I', t, t);
    execute format('drop policy if exists %I_del on %I', t, t);
    execute format('create policy %I_select on %I for select using (is_salestrack_admin() or org_id in (select user_org_ids()))', t, t);
    execute format('create policy %I_ins on %I for insert with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_upd on %I for update using (is_salestrack_admin()) with check (is_salestrack_admin())', t, t);
    execute format('create policy %I_del on %I for delete using (is_salestrack_admin())', t, t);
  end loop;
end $$;
