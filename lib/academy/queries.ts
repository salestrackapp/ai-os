import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Consultas da Academy. Todas rodam sob RLS (cliente de lib/supabase/server), nunca com
 * service role — o portão de matrícula está no banco, não aqui. Se uma consulta volta vazia,
 * é porque a pessoa não tem acesso, e isso é o comportamento correto.
 */

export type CursoResumo = {
  id: string; slug: string; titulo: string; subtitulo: string | null;
  nivel: string; carga_horaria_min: number | null;
};

export type ModuloComProgresso = {
  id: string; ordem: number; titulo: string; icone: string | null; cor: string | null;
  objetivo: string | null; tempo_label: string | null;
  tarefas: { id: string; ordem: number; texto: string; feita: boolean }[];
  aulas: number;
};

export async function buscarCursoPorSlug(slug: string) {
  const sb = await createClient();
  const { data } = await sb.from("academy_courses")
    .select("id, slug, titulo, subtitulo, descricao, nivel, carga_horaria_min, certificado, exige_conclusao, nota_minima")
    .eq("slug", slug).is("deleted_at", null).maybeSingle();
  return data;
}

/** Matrícula ativa do usuário atual neste curso (nula = sem acesso de aluno). */
export async function minhaMatricula(courseId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("academy_enrollments")
    .select("id, status, org_id, nome, completed_at")
    .eq("course_id", courseId).eq("user_id", user.id).maybeSingle();
  return data;
}

/**
 * Módulos do curso com as tarefas e o que a PESSOA já concluiu.
 * O progresso vem por enrollment_id, então é individual mesmo quando dez colegas da mesma
 * empresa fazem a trilha — que é exatamente o defeito que o Estúdio tinha.
 */
export async function modulosComProgresso(courseId: string, enrollmentId: string | null): Promise<ModuloComProgresso[]> {
  const sb = await createClient();
  const { data: mods } = await sb.from("academy_modules")
    .select("id, ordem, titulo, icone, cor, objetivo, tempo_label")
    .eq("course_id", courseId).order("ordem");
  if (!mods?.length) return [];

  const ids = mods.map((m) => m.id);
  const [{ data: tarefas }, { data: aulas }, { data: feitas }] = await Promise.all([
    sb.from("academy_tasks").select("id, module_id, ordem, texto").in("module_id", ids).order("ordem"),
    sb.from("academy_lessons").select("id, module_id").in("module_id", ids),
    enrollmentId
      ? sb.from("academy_progress").select("task_id").eq("enrollment_id", enrollmentId).not("task_id", "is", null)
      : Promise.resolve({ data: [] as { task_id: string | null }[] }),
  ]);

  const concluidas = new Set((feitas ?? []).map((p) => p.task_id));
  const porModulo = new Map(ids.map((id) => [id, { tarefas: [] as ModuloComProgresso["tarefas"], aulas: 0 }]));
  for (const t of tarefas ?? []) {
    porModulo.get(t.module_id)?.tarefas.push({ id: t.id, ordem: t.ordem, texto: t.texto, feita: concluidas.has(t.id) });
  }
  for (const a of aulas ?? []) {
    const e = porModulo.get(a.module_id); if (e) e.aulas++;
  }

  return mods.map((m) => ({ ...m, ...porModulo.get(m.id)! }));
}

export async function aulasDoModulo(moduleId: string) {
  const sb = await createClient();
  const { data } = await sb.from("academy_lessons")
    .select("id, ordem, titulo, tipo, corpo, tempo_min").eq("module_id", moduleId).order("ordem");
  return data ?? [];
}

/** Módulo concluído ⟺ todas as tarefas dele marcadas. Curso concluído ⟺ todos os módulos. */
export function progressoDoCurso(mods: ModuloComProgresso[]) {
  const total = mods.reduce((a, m) => a + m.tarefas.length, 0);
  const feitas = mods.reduce((a, m) => a + m.tarefas.filter((t) => t.feita).length, 0);
  const modulosOk = mods.filter((m) => m.tarefas.length > 0 && m.tarefas.every((t) => t.feita)).length;
  return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0, modulosOk, modulos: mods.length };
}
