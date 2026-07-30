-- 039 · Academy · Fase 2 Bloco 1: fundação de acesso
-- Aditivo e reversível: nenhum DROP de tabela ou coluna.
--
-- A decisão estrutural desta fase: MATRÍCULA é a primitiva de acesso ao conteúdo de formação,
-- não a organização. user_org_ids() devolve conjunto vazio para quem não tem membership, então
-- um aluno avulso é invisível para toda policy escopada por org. Criar uma "organização pessoal"
-- por aluno resolveria, mas cria o quarto conceito de tenant que o plano mestre proíbe.
--
-- academy_enrollments.org_id é NULÁVEL: nulo = aluno individual. Não é padrão novo — é o mesmo
-- desenho de notifications (migration 033): user_id obrigatório, org_id opcional, policy pessoal.
--
-- Estilo de RLS: UMA POLICY POR COMANDO (não FOR ALL), conforme consolidado nas migrations 034-038.
-- auth.uid() sempre em subconsulta, para o planejador avaliar uma vez por consulta e não por linha.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: orgs onde o usuário é gestor. Simétrico a user_org_ids().
-- Existe para não repetir o exists(...) de memberships 4 vezes por tabela em 6 tabelas.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function academy_manager_org_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.org_id from memberships m
  where m.user_id = auth.uid() and m.role::text in ('client_admin','sponsor');
$$;
revoke execute on function academy_manager_org_ids() from public;
grant execute on function academy_manager_org_ids() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conteúdo
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists academy_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  subtitulo text,
  descricao text,
  nivel text not null default 'iniciante'
    constraint ac_nivel_check check (nivel in ('iniciante','intermediario','avancado')),
  carga_horaria_min int,
  capa_url text,
  acesso text not null default 'restrito'
    constraint ac_acesso_check check (acesso in ('restrito','aberto','link')),
  status text not null default 'rascunho'
    constraint ac_status_check check (status in ('rascunho','revisao','publicado','arquivado')),
  certificado boolean not null default true,
  exige_conclusao boolean not null default true,   -- todas as tarefas antes de liberar a prova
  nota_minima int not null default 70
    constraint ac_nota_check check (nota_minima between 0 and 100),
  brand_attribution text not null default 'salestrack'
    constraint ac_brand_check check (brand_attribution in ('salestrack','andre_kachan')),
  versao int not null default 1,                   -- carimbado no certificado
  publicado_em timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ix_academy_courses_alive on academy_courses(deleted_at) where deleted_at is null;

create table if not exists academy_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references academy_courses(id) on delete cascade,
  ordem int not null,                              -- 0-based: preserva o "Módulo 0" da fonte
  titulo text not null,
  icone text,
  cor text,
  objetivo text,
  tempo_label text,
  tempo_min int,
  created_at timestamptz not null default now(),
  unique (course_id, ordem)
);
create index if not exists ix_academy_modules_course on academy_modules(course_id);

-- corpo guarda a seção EXATAMENTE como veio da fonte, nomes de campo intactos.
-- tipo não tem check constraint de propósito: são 19 formas hoje e conteúdo novo inventa mais.
-- Precedente da casa: studio_deliverables.kind tem 31 valores e nenhum check; validação em TS.
create table if not exists academy_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references academy_modules(id) on delete cascade,
  ordem int not null,
  titulo text not null,
  tipo text not null default 'conceito',
  corpo jsonb not null default '{}'::jsonb,
  tempo_min int,
  created_at timestamptz not null default now(),
  unique (module_id, ordem)
);
create index if not exists ix_academy_lessons_module on academy_lessons(module_id);

create table if not exists academy_tasks (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references academy_modules(id) on delete cascade,
  ordem int not null,
  texto text not null,
  created_at timestamptz not null default now(),
  unique (module_id, ordem)
);
create index if not exists ix_academy_tasks_module on academy_tasks(module_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Acesso e progresso
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists academy_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references academy_courses(id) on delete cascade,
  user_id uuid not null,                                        -- auth.users.id (sem FK: padrão de notifications)
  org_id uuid references organizations(id) on delete set null,  -- NULL = aluno individual
  origem text not null default 'individual'
    constraint ae_origem_check check (origem in ('individual','org','salestrack')),
  status text not null default 'ativa'
    constraint ae_status_check check (status in ('ativa','concluida','cancelada','expirada')),
  nome text,                                       -- nome para o certificado (individual não tem contact)
  email text,
  seat_by uuid,                                    -- quem alocou a vaga
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists ix_academy_enrollments_user on academy_enrollments(user_id);
create index if not exists ix_academy_enrollments_org on academy_enrollments(org_id) where org_id is not null;
create index if not exists ix_academy_enrollments_course on academy_enrollments(course_id);

-- Progresso ancora em FK REAL para a aula/tarefa, nunca em índice numérico.
-- É o que impede reordenar módulo e embaralhar as conclusões de quem já estudou.
create table if not exists academy_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references academy_enrollments(id) on delete cascade,
  lesson_id uuid references academy_lessons(id) on delete cascade,
  task_id uuid references academy_tasks(id) on delete cascade,
  status text not null default 'concluido'
    constraint apg_status_check check (status in ('visto','concluido')),
  done_at timestamptz not null default now(),
  constraint apg_alvo_check check (num_nonnulls(lesson_id, task_id) = 1)
);
create unique index if not exists ux_academy_progress_lesson on academy_progress(enrollment_id, lesson_id) where lesson_id is not null;
create unique index if not exists ux_academy_progress_task on academy_progress(enrollment_id, task_id) where task_id is not null;
create index if not exists ix_academy_progress_enrollment on academy_progress(enrollment_id);

-- Ponte com o Estúdio: quando a Salestrack "entrega" a trilha a um cliente, o card em
-- /portal/entregaveis segue funcionando e aponta para o curso da Academy.
alter table studio_deliverables add column if not exists academy_course_id uuid references academy_courses(id);
create index if not exists ix_studio_deliverables_academy on studio_deliverables(academy_course_id) where academy_course_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table academy_courses enable row level security;
alter table academy_modules enable row level security;
alter table academy_lessons enable row level security;
alter table academy_tasks enable row level security;
alter table academy_enrollments enable row level security;
alter table academy_progress enable row level security;

-- Cursos: publicado é legível por quem tem matrícula ativa (ou se o acesso for aberto).
-- Rascunho, só admin.
drop policy if exists academy_courses_select on academy_courses;
create policy academy_courses_select on academy_courses for select to authenticated
  using (
    is_salestrack_admin()
    or (deleted_at is null and status = 'publicado' and (
          acesso = 'aberto'
          or exists (select 1 from academy_enrollments e
                     where e.course_id = academy_courses.id
                       and e.user_id = (select auth.uid()) and e.status = 'ativa')))
  );
drop policy if exists academy_courses_ins on academy_courses;
create policy academy_courses_ins on academy_courses for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_courses_upd on academy_courses;
create policy academy_courses_upd on academy_courses for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_courses_del on academy_courses;
create policy academy_courses_del on academy_courses for delete to authenticated using (is_salestrack_admin());

-- Módulos, aulas e tarefas herdam o filtro do curso.
-- Uma subconsulta dentro de policy também está sujeita à RLS da tabela referenciada, então o
-- exists(...) abaixo herda o portão de academy_courses. A condição de matrícula fica escrita
-- UMA vez só. Há teste de RLS provando que a herança realmente vale.
drop policy if exists academy_modules_select on academy_modules;
create policy academy_modules_select on academy_modules for select to authenticated
  using (is_salestrack_admin() or exists (select 1 from academy_courses c where c.id = course_id));
drop policy if exists academy_modules_ins on academy_modules;
create policy academy_modules_ins on academy_modules for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_modules_upd on academy_modules;
create policy academy_modules_upd on academy_modules for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_modules_del on academy_modules;
create policy academy_modules_del on academy_modules for delete to authenticated using (is_salestrack_admin());

drop policy if exists academy_lessons_select on academy_lessons;
create policy academy_lessons_select on academy_lessons for select to authenticated
  using (is_salestrack_admin() or exists (select 1 from academy_modules m where m.id = module_id));
drop policy if exists academy_lessons_ins on academy_lessons;
create policy academy_lessons_ins on academy_lessons for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_lessons_upd on academy_lessons;
create policy academy_lessons_upd on academy_lessons for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_lessons_del on academy_lessons;
create policy academy_lessons_del on academy_lessons for delete to authenticated using (is_salestrack_admin());

drop policy if exists academy_tasks_select on academy_tasks;
create policy academy_tasks_select on academy_tasks for select to authenticated
  using (is_salestrack_admin() or exists (select 1 from academy_modules m where m.id = module_id));
drop policy if exists academy_tasks_ins on academy_tasks;
create policy academy_tasks_ins on academy_tasks for insert to authenticated with check (is_salestrack_admin());
drop policy if exists academy_tasks_upd on academy_tasks;
create policy academy_tasks_upd on academy_tasks for update to authenticated using (is_salestrack_admin()) with check (is_salestrack_admin());
drop policy if exists academy_tasks_del on academy_tasks;
create policy academy_tasks_del on academy_tasks for delete to authenticated using (is_salestrack_admin());

-- Matrículas: o aluno lê a sua; o gestor lê as da org dele; o admin lê todas.
-- O aluno NÃO atualiza a própria matrícula — nada de estender a própria validade ou se
-- marcar como concluído. completed_at é escrito pela ação de certificado.
drop policy if exists academy_enrollments_select on academy_enrollments;
create policy academy_enrollments_select on academy_enrollments for select to authenticated
  using (
    is_salestrack_admin()
    or user_id = (select auth.uid())
    or (org_id is not null and org_id in (select academy_manager_org_ids()))
  );
-- A terceira cláusula do insert é a auto-matrícula, único ponto do sistema onde um não-admin
-- cria linha para si mesmo — e só em curso explicitamente marcado como aberto.
-- Gestor só matricula quem já é da equipe dele: "vaga pertence ao seu time" vira invariante
-- do banco em vez de convenção de tela.
drop policy if exists academy_enrollments_ins on academy_enrollments;
create policy academy_enrollments_ins on academy_enrollments for insert to authenticated
  with check (
    is_salestrack_admin()
    or (org_id is not null and org_id in (select academy_manager_org_ids())
        and exists (select 1 from memberships m
                    where m.user_id = academy_enrollments.user_id and m.org_id = academy_enrollments.org_id))
    or (user_id = (select auth.uid()) and org_id is null
        and exists (select 1 from academy_courses c
                    where c.id = course_id and c.acesso = 'aberto' and c.status = 'publicado'))
  );
drop policy if exists academy_enrollments_upd on academy_enrollments;
create policy academy_enrollments_upd on academy_enrollments for update to authenticated
  using (is_salestrack_admin() or (org_id is not null and org_id in (select academy_manager_org_ids())))
  with check (is_salestrack_admin() or (org_id is not null and org_id in (select academy_manager_org_ids())));
drop policy if exists academy_enrollments_del on academy_enrollments;
create policy academy_enrollments_del on academy_enrollments for delete to authenticated
  using (is_salestrack_admin() or (org_id is not null and org_id in (select academy_manager_org_ids())));

-- Progresso: leitura herda o filtro de matrícula (gestor vê o time, aluno vê o dele);
-- escrita é SEMPRE só do próprio — gestor não marca tarefa de subordinado como feita.
drop policy if exists academy_progress_select on academy_progress;
create policy academy_progress_select on academy_progress for select to authenticated
  using (exists (select 1 from academy_enrollments e where e.id = enrollment_id));
drop policy if exists academy_progress_ins on academy_progress;
create policy academy_progress_ins on academy_progress for insert to authenticated
  with check (is_salestrack_admin() or exists (
    select 1 from academy_enrollments e
    where e.id = enrollment_id and e.user_id = (select auth.uid()) and e.status = 'ativa'));
drop policy if exists academy_progress_upd on academy_progress;
create policy academy_progress_upd on academy_progress for update to authenticated
  using (is_salestrack_admin() or exists (
    select 1 from academy_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid())))
  with check (is_salestrack_admin() or exists (
    select 1 from academy_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid())));
drop policy if exists academy_progress_del on academy_progress;
create policy academy_progress_del on academy_progress for delete to authenticated
  using (is_salestrack_admin() or exists (
    select 1 from academy_enrollments e where e.id = enrollment_id and e.user_id = (select auth.uid())));

-- ─────────────────────────────────────────────────────────────────────────────
-- Correção de defeito herdado: 'publicado' faltava no portão de leitura do cliente.
-- A 021 adicionou 'publicado' como status válido e o app o trata como entregue, mas a policy
-- de leitura nunca foi atualizada — um entregável publicado era invisível ao cliente por RLS,
-- o que forçou /portal/entregaveis a contornar com service client.
-- Definição abaixo é a da 037, alterando apenas a lista de status.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists studio_deliverables_select on studio_deliverables;
create policy studio_deliverables_select on studio_deliverables for select to authenticated
  using (is_salestrack_admin()
         or (org_id in (select user_org_ids()) and status in ('aprovado','entregue','publicado')));
