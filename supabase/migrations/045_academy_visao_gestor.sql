-- 045 · Academy · Fase 2 Bloco 8: visão do gestor
--
-- security_invoker = on é OBRIGATÓRIO. Sem isso a view roda com os privilégios do dono e
-- vaza a turma de TODOS os clientes para qualquer gestor. Com ele, a RLS das tabelas de baixo
-- se aplica a quem consulta: o gestor vê só a org dele, o aluno vê só a linha dele, o admin
-- vê tudo — sem um segundo conjunto de policies para manter em sincronia.
--
-- A view NÃO expõe respostas de prova: `academy_attempt_respostas` não entra aqui. O gestor
-- lê a nota do colaborador, não a prova dele. É a mesma fronteira de privacidade da 043.
create or replace view academy_enrollment_stats
with (security_invoker = on) as
select
  e.id                                as enrollment_id,
  e.course_id,
  e.user_id,
  e.org_id,
  e.nome,
  e.email,
  e.status,
  e.origem,
  e.created_at,
  e.completed_at,
  c.titulo                            as curso,
  (select count(*) from academy_tasks t
     join academy_modules m on m.id = t.module_id
    where m.course_id = e.course_id)  as tarefas_total,
  (select count(*) from academy_progress p
    where p.enrollment_id = e.id and p.task_id is not null) as tarefas_feitas,
  (select max(p.done_at) from academy_progress p where p.enrollment_id = e.id) as ultima_atividade,
  (select max(a.nota) from academy_attempts a where a.enrollment_id = e.id) as melhor_nota,
  (select count(*) from academy_attempts a where a.enrollment_id = e.id)    as tentativas,
  exists (select 1 from academy_attempts a where a.enrollment_id = e.id and a.status = 'aprovado') as aprovado,
  exists (select 1 from formacao_certificados f where f.enrollment_id = e.id and f.deleted_at is null) as tem_certificado
from academy_enrollments e
join academy_courses c on c.id = e.course_id;
