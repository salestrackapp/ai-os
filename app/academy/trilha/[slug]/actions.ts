"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

/**
 * Marca/desmarca uma tarefa da trilha.
 *
 * Não há checagem manual de posse aqui de propósito: a policy de insert de academy_progress
 * exige que enrollment_id pertença a quem está chamando e esteja ativa. Se alguém tentar
 * marcar tarefa na matrícula alheia, o banco recusa — e há teste de RLS provando isso.
 */
export async function marcarTarefa(enrollmentId: string, taskId: string, slug: string) {
  const sb = await createClient();
  const { error } = await sb.from("academy_progress")
    .insert({ enrollment_id: enrollmentId, task_id: taskId, status: "concluido" });
  // 23505 = violação de unicidade: já estava marcada, então não é erro para o usuário.
  if (error && error.code !== "23505") throw new Error(error.message);
  await audit("academy.tarefa_concluida", "academy_progress", taskId, { enrollmentId });
  revalidatePath(`/academy/trilha/${slug}`);
}

export async function desmarcarTarefa(enrollmentId: string, taskId: string, slug: string) {
  const sb = await createClient();
  const { error } = await sb.from("academy_progress")
    .delete().eq("enrollment_id", enrollmentId).eq("task_id", taskId);
  if (error) throw new Error(error.message);
  await audit("academy.tarefa_desfeita", "academy_progress", taskId, { enrollmentId });
  revalidatePath(`/academy/trilha/${slug}`);
}
