-- 043 · Academy · Fase 2 Bloco 6: avaliação e certificado automático
-- Aditivo e reversível: nenhum DROP de tabela ou coluna.
--
-- O problema desta migration é de CONFIANÇA, não de modelagem. O cliente tem a chave anônima e
-- fala direto com o PostgREST, então duas coisas precisam ser inalcançáveis pelo aluno:
--
--   1. O GABARITO. Se ficasse em academy_questions, um aluno matriculado faria
--      `select gabarito from academy_questions` no navegador e teria a prova resolvida.
--      Por isso ele mora em academy_question_keys, tabela SEM policy de aluno — só admin.
--
--   2. A NOTA. Server Action roda no contexto RLS de quem chama. Se o aluno pudesse dar update
--      na própria tentativa, escreveria nota=100/status='aprovado' e dispararia o certificado.
--      Duas camadas: a policy de update só aceita linha 'em_andamento' com nota nula, e o
--      gatilho trg_academy_attempt_guard rejeita qualquer alteração de nota/acertos/status
--      vinda de sessão não-admin. A correção final roda com service client, atrás de guarda
--      local de posse — exceção estreita, em uma única função, como emitirCertificadoAction.
--
-- Estilo de RLS: UMA POLICY POR COMANDO (não FOR ALL), como nas 034-038 e na 039.
-- auth.uid() sempre em subconsulta, para avaliar uma vez por consulta e não por linha.

-- ─────────────────────────────────────────────────────────────────────────────
-- Prova
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists academy_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references academy_courses(id) on delete cascade,
  titulo text not null default 'Avaliação final',
  descricao text,
  nota_minima int not null default 70
    constraint aas_nota_check check (nota_minima between 0 and 100),
  tentativas_max int not null default 3
    constraint aas_tent_check check (tentativas_max between 1 and 20),
  -- exige as tarefas do curso concluídas antes de liberar a prova
  exige_conclusao boolean not null default true,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- uma prova por curso: simplifica o gate e evita "qual das provas vale?"
  unique (course_id)
);

-- Enunciado e alternativas são PÚBLICOS para quem tem matrícula; o gabarito não está aqui.
create table if not exists academy_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references academy_assessments(id) on delete cascade,
  ordem int not null,
  enunciado text not null,
  tipo text not null default 'multipla'
    constraint aq_tipo_check check (tipo in ('multipla','vf')),
  -- v1 só tem objetivas: correção e emissão sem ninguém no meio.
  alternativas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (assessment_id, ordem)
);
create index if not exists ix_aq_assessment on academy_questions(assessment_id);

-- O gabarito, isolado. Nenhuma policy de aluno — nem de leitura.
create table if not exists academy_question_keys (
  question_id uuid primary key references academy_questions(id) on delete cascade,
  -- índice 0-based da alternativa (multipla) ou 'V'/'F' (vf); mesmo formato de corrigirTeste()
  gabarito text not null,
  explicacao text,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tentativas
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists academy_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references academy_enrollments(id) on delete cascade,
  assessment_id uuid not null references academy_assessments(id) on delete cascade,
  numero int not null default 1,
  status text not null default 'em_andamento'
    constraint aat_status_check check (status in ('em_andamento','aprovado','reprovado')),
  nota int constraint aat_nota_check check (nota is null or nota between 0 and 100),
  acertos int,
  objetivas int,
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  unique (enrollment_id, assessment_id, numero)
);
create index if not exists ix_aat_enrollment on academy_attempts(enrollment_id);

-- Respostas em tabela separada de propósito: o gestor lê a NOTA do colaborador
-- (academy_attempts) mas NÃO as respostas dele. Ver a nota não é ver a prova.
create table if not exists academy_attempt_respostas (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references academy_attempts(id) on delete cascade,
  question_id uuid not null references academy_questions(id) on delete cascade,
  resposta text,
  unique (attempt_id, question_id)
);
create index if not exists ix_aar_attempt on academy_attempt_respostas(attempt_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Gatilho anti-forja: nota, acertos e status só mudam por service role ou admin.
-- A policy de update já restringe a linha alcançável; isto fecha o caso de um admin
-- de cliente (client_admin) que enxergue a linha por outro caminho.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function fn_academy_attempt_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- auth.uid() é nulo sob service role: é assim que a correção legítima passa.
  if (select auth.uid()) is null or is_salestrack_admin() then
    return new;
  end if;
  if new.nota is distinct from old.nota
     or new.acertos is distinct from old.acertos
     or new.objetivas is distinct from old.objetivas
     or new.status is distinct from old.status then
    raise exception 'nota e situacao da tentativa sao definidas pela correcao, nao pelo aluno';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_academy_attempt_guard on academy_attempts;
create trigger trg_academy_attempt_guard before update on academy_attempts
  for each row execute function fn_academy_attempt_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- Certificado: afrouxar formacao_certificados para caber o aluno sem empresa.
-- org_id era NOT NULL — era esse o bloqueio duro do aluno avulso, não o modelo de dados.
-- ─────────────────────────────────────────────────────────────────────────────
alter table formacao_certificados alter column org_id drop not null;
alter table formacao_certificados add column if not exists enrollment_id uuid references academy_enrollments(id) on delete set null;
alter table formacao_certificados add column if not exists course_id uuid references academy_courses(id) on delete set null;
alter table formacao_certificados add column if not exists attempt_id uuid references academy_attempts(id) on delete set null;
alter table formacao_certificados add column if not exists user_id uuid;
-- course_versao carimba a versão que a pessoa passou: o curso é editável de propósito
-- (sem gatilho de imutabilidade), então o certificado precisa nomear o que foi cursado.
alter table formacao_certificados add column if not exists course_versao int;
-- código curto para verificação pública. O código É o segredo, como nos outros /[token].
alter table formacao_certificados add column if not exists codigo text;
create unique index if not exists uq_fc_codigo on formacao_certificados(codigo) where codigo is not null;
create index if not exists ix_fc_enrollment on formacao_certificados(enrollment_id);
create index if not exists ix_fc_user on formacao_certificados(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table academy_assessments enable row level security;
alter table academy_questions enable row level security;
alter table academy_question_keys enable row level security;
alter table academy_attempts enable row level security;
alter table academy_attempt_respostas enable row level security;

-- Prova: quem tem matrícula ativa no curso enxerga; escrita só admin.
drop policy if exists academy_assessments_select on academy_assessments;
create policy academy_assessments_select on academy_assessments for select to authenticated
  using (
    is_salestrack_admin()
    or exists (select 1 from academy_enrollments e
               where e.course_id = academy_assessments.course_id
                 and e.user_id = (select auth.uid()) and e.status = 'ativa')
  );
drop policy if exists academy_assessments_ins on academy_assessments;
create policy academy_assessments_ins on academy_assessments for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_assessments_upd on academy_assessments;
create policy academy_assessments_upd on academy_assessments for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_assessments_del on academy_assessments;
create policy academy_assessments_del on academy_assessments for delete to authenticated using (is_salestrack_admin());

-- Questões herdam o filtro da prova (a subconsulta também passa pela RLS de academy_assessments).
drop policy if exists academy_questions_select on academy_questions;
create policy academy_questions_select on academy_questions for select to authenticated
  using (is_salestrack_admin() or exists (select 1 from academy_assessments a where a.id = assessment_id));
drop policy if exists academy_questions_ins on academy_questions;
create policy academy_questions_ins on academy_questions for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_questions_upd on academy_questions;
create policy academy_questions_upd on academy_questions for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_questions_del on academy_questions;
create policy academy_questions_del on academy_questions for delete to authenticated using (is_salestrack_admin());

-- GABARITO: só admin, inclusive na leitura. É o ponto inteiro da tabela existir.
drop policy if exists academy_question_keys_select on academy_question_keys;
create policy academy_question_keys_select on academy_question_keys for select to authenticated using (is_salestrack_admin());
drop policy if exists academy_question_keys_ins on academy_question_keys;
create policy academy_question_keys_ins on academy_question_keys for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_question_keys_upd on academy_question_keys;
create policy academy_question_keys_upd on academy_question_keys for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_question_keys_del on academy_question_keys;
create policy academy_question_keys_del on academy_question_keys for delete to authenticated using (is_salestrack_admin());

-- Tentativas: o aluno vê a sua; o gestor vê as da org dele (nota, não respostas); admin vê todas.
drop policy if exists academy_attempts_select on academy_attempts;
create policy academy_attempts_select on academy_attempts for select to authenticated
  using (
    is_salestrack_admin()
    or exists (select 1 from academy_enrollments e where e.id = enrollment_id
               and (e.user_id = (select auth.uid())
                    or (e.org_id is not null and e.org_id in (select academy_manager_org_ids()))))
  );
-- O aluno abre a própria tentativa; nota e status entram só na correção.
drop policy if exists academy_attempts_ins on academy_attempts;
create policy academy_attempts_ins on academy_attempts for insert to authenticated
  with check (
    is_salestrack_admin()
    or (nota is null and status = 'em_andamento'
        and exists (select 1 from academy_enrollments e where e.id = enrollment_id
                    and e.user_id = (select auth.uid()) and e.status = 'ativa'))
  );
-- Update do aluno só alcança linha ainda aberta e sem nota. Combinado com o gatilho,
-- não há caminho para ele escrever a própria nota.
drop policy if exists academy_attempts_upd on academy_attempts;
create policy academy_attempts_upd on academy_attempts for update to authenticated
  using (
    is_salestrack_admin()
    or (status = 'em_andamento' and nota is null
        and exists (select 1 from academy_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid())))
  )
  with check (
    is_salestrack_admin()
    or (status = 'em_andamento' and nota is null
        and exists (select 1 from academy_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid())))
  );
drop policy if exists academy_attempts_del on academy_attempts;
create policy academy_attempts_del on academy_attempts for delete to authenticated using (is_salestrack_admin());

-- Respostas: SÓ o dono e o admin. O gestor não entra aqui — é a fronteira de privacidade.
drop policy if exists academy_attempt_respostas_select on academy_attempt_respostas;
create policy academy_attempt_respostas_select on academy_attempt_respostas for select to authenticated
  using (
    is_salestrack_admin()
    or exists (select 1 from academy_attempts t join academy_enrollments e on e.id = t.enrollment_id
               where t.id = attempt_id and e.user_id = (select auth.uid()))
  );
drop policy if exists academy_attempt_respostas_ins on academy_attempt_respostas;
create policy academy_attempt_respostas_ins on academy_attempt_respostas for insert to authenticated
  with check (
    is_salestrack_admin()
    or exists (select 1 from academy_attempts t join academy_enrollments e on e.id = t.enrollment_id
               where t.id = attempt_id and e.user_id = (select auth.uid()) and t.status = 'em_andamento')
  );
drop policy if exists academy_attempt_respostas_upd on academy_attempt_respostas;
create policy academy_attempt_respostas_upd on academy_attempt_respostas for update to authenticated
  using (
    is_salestrack_admin()
    or exists (select 1 from academy_attempts t join academy_enrollments e on e.id = t.enrollment_id
               where t.id = attempt_id and e.user_id = (select auth.uid()) and t.status = 'em_andamento')
  )
  with check (
    is_salestrack_admin()
    or exists (select 1 from academy_attempts t join academy_enrollments e on e.id = t.enrollment_id
               where t.id = attempt_id and e.user_id = (select auth.uid()) and t.status = 'em_andamento')
  );
drop policy if exists academy_attempt_respostas_del on academy_attempt_respostas;
create policy academy_attempt_respostas_del on academy_attempt_respostas for delete to authenticated using (is_salestrack_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Certificado: a policy antiga (023) só olhava org_id, então o aluno avulso — que tem
-- org_id nulo — não enxergava o próprio certificado. Reescrita para incluir a matrícula.
-- Estilo antigo (FOR ALL) trocado por uma policy por comando, como no resto da Academy.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists fc_admin on formacao_certificados;
drop policy if exists fc_client_read on formacao_certificados;

drop policy if exists formacao_certificados_select on formacao_certificados;
create policy formacao_certificados_select on formacao_certificados for select to authenticated
  using (
    is_salestrack_admin()
    or user_id = (select auth.uid())
    or (org_id is not null and org_id in (select user_org_ids()))
    or exists (select 1 from academy_enrollments e where e.id = enrollment_id
               and (e.user_id = (select auth.uid())
                    or (e.org_id is not null and e.org_id in (select academy_manager_org_ids()))))
  );
-- Emissão é do sistema (service role) ou do admin. Ninguém emite o próprio certificado.
drop policy if exists formacao_certificados_ins on formacao_certificados;
create policy formacao_certificados_ins on formacao_certificados for insert to authenticated with check (is_salestrack_admin());
drop policy if exists formacao_certificados_upd on formacao_certificados;
create policy formacao_certificados_upd on formacao_certificados for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists formacao_certificados_del on formacao_certificados;
create policy formacao_certificados_del on formacao_certificados for delete to authenticated using (is_salestrack_admin());
