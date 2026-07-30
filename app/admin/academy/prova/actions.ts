"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";

/**
 * Edição da prova pelo admin.
 *
 * Usa service client por um motivo específico: `academy_question_keys` tem policy só de admin,
 * e a questão e o gabarito precisam ser gravados juntos — o admin não deveria ter de lembrar
 * de duas telas para uma coisa só. A autorização é local e explícita, no topo de cada função.
 */
async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return createServiceClient();
}

export async function salvarProva(courseId: string, dados: {
  titulo: string; descricao: string; notaMinima: number; tentativasMax: number; exigeConclusao: boolean; ativa: boolean;
}) {
  const svc = await exigirAdmin();
  if (!dados.titulo.trim()) throw new Error("Dê um título à prova.");

  const { error } = await svc.from("academy_assessments").upsert({
    course_id: courseId,
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim() || null,
    nota_minima: dados.notaMinima,
    tentativas_max: dados.tentativasMax,
    exige_conclusao: dados.exigeConclusao,
    ativa: dados.ativa,
    updated_at: new Date().toISOString(),
  }, { onConflict: "course_id" });
  if (error) throw new Error(error.message);

  await audit("academy.prova_editada", "academy_assessments", courseId, { titulo: dados.titulo });
  revalidatePath("/admin/academy/prova");
  revalidatePath("/academy/prova");
}

export async function salvarQuestao(assessmentId: string, q: {
  id?: string; ordem: number; enunciado: string; tipo: "multipla" | "vf";
  alternativas: string[]; gabarito: string;
}) {
  const svc = await exigirAdmin();
  if (!q.enunciado.trim()) throw new Error("Escreva o enunciado da questão.");

  const alternativas = q.tipo === "multipla" ? q.alternativas.map((a) => a.trim()).filter(Boolean) : [];
  if (q.tipo === "multipla") {
    if (alternativas.length < 2) throw new Error("Uma questão de múltipla escolha precisa de pelo menos 2 alternativas.");
    const i = Number(q.gabarito);
    if (!Number.isInteger(i) || i < 0 || i >= alternativas.length) {
      throw new Error("Marque qual alternativa é a correta.");
    }
  } else if (!["V", "F"].includes(q.gabarito)) {
    throw new Error("Marque se a afirmação é verdadeira ou falsa.");
  }

  const linha = { assessment_id: assessmentId, ordem: q.ordem, enunciado: q.enunciado.trim(), tipo: q.tipo, alternativas };
  const { data, error } = q.id
    ? await svc.from("academy_questions").update(linha).eq("id", q.id).select("id").single()
    : await svc.from("academy_questions").insert(linha).select("id").single();
  if (error) throw new Error(error.message);

  // gabarito na tabela isolada, no mesmo passo — quem edita não precisa saber que são duas
  const { error: eg } = await svc.from("academy_question_keys")
    .upsert({ question_id: data.id, gabarito: q.gabarito, updated_at: new Date().toISOString() }, { onConflict: "question_id" });
  if (eg) throw new Error(eg.message);

  await audit("academy.questao_salva", "academy_questions", data.id, { ordem: q.ordem });
  revalidatePath("/admin/academy/prova");
}

export async function excluirQuestao(id: string) {
  const svc = await exigirAdmin();
  // o gabarito cai junto pelo on delete cascade da FK
  const { error } = await svc.from("academy_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("academy.questao_excluida", "academy_questions", id);
  revalidatePath("/admin/academy/prova");
}

/** Cursos com prova, para o seletor da tela. */
export async function cursosComProva() {
  const sb = await createClient();
  const { data } = await sb.from("academy_courses").select("id, titulo").is("deleted_at", null).order("titulo");
  return data ?? [];
}
