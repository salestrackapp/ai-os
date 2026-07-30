-- 046 · Academy · o gestor precisa LER o curso onde a equipe dele está matriculada.
--
-- Defeito encontrado ao testar a visão da turma: a policy de academy_courses só considerava
-- matrícula do PRÓPRIO usuário. O gestor não é aluno — não tem matrícula —, então o curso
-- voltava vazio para ele. Como `academy_enrollment_stats` faz `join academy_courses`, o join
-- zerava a turma inteira e a tela dizia "ninguém matriculado" com três pessoas matriculadas.
--
-- Consertar na policy, e não removendo o join da view, porque o gestor legitimamente precisa
-- do nome do curso — e qualquer outra tela que junte curso com matrícula teria o mesmo problema.
drop policy if exists academy_courses_select on academy_courses;
create policy academy_courses_select on academy_courses for select to authenticated
  using (
    is_salestrack_admin()
    or (deleted_at is null and status = 'publicado' and (
          acesso = 'aberto'
          or exists (
            select 1 from academy_enrollments e
             where e.course_id = academy_courses.id
               and e.user_id = (select auth.uid())
               and e.status = 'ativa'
          )
          or exists (
            select 1 from academy_enrollments e
             where e.course_id = academy_courses.id
               and e.org_id is not null
               and e.org_id in (select academy_manager_org_ids())
          )
    ))
  );
