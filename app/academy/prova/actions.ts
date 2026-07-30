"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { audit } from "@/lib/audit";
import { corrigirProva, gerarCodigoCertificado } from "@/lib/academy/grading";
import { buildCertificateHtml } from "@/lib/studio/render/certificate";
import { htmlToPdf } from "@/lib/deliverables/render/pdf";

/**
 * Prova da Academy. As duas escritas sensíveis do sistema de formação vivem aqui.
 *
 * A abertura da tentativa roda sob RLS, com a sessão do aluno: a policy já exige matrícula
 * ativa e `nota is null`. A CORREÇÃO roda com service client, porque precisa ler
 * `academy_question_keys` — que não tem policy de aluno — e gravar a nota, que o gatilho
 * proíbe a sessão do aluno de tocar. Toda função com service client aqui começa
 * confirmando a posse da tentativa; a autorização é local e explícita, nunca implícita.
 */

/** Confere que a tentativa é de quem está chamando. Nenhuma escrita passa sem isto. */
async function tentativaDoUsuario(attemptId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");

  const svc = createServiceClient();
  const { data: t } = await svc.from("academy_attempts")
    .select("id, status, numero, enrollment_id, assessment_id, academy_enrollments!inner(id, user_id, org_id, course_id, nome, email)")
    .eq("id", attemptId).maybeSingle();
  if (!t) throw new Error("Tentativa não encontrada.");

  const matricula = t.academy_enrollments as unknown as
    { id: string; user_id: string; org_id: string | null; course_id: string; nome: string | null; email: string | null };
  if (matricula.user_id !== user.id) throw new Error("Esta prova não é sua.");
  return { svc, userId: user.id, tentativa: t, matricula };
}

/** Abre uma tentativa. Roda sob RLS — é o aluno quem insere a própria linha. */
export async function iniciarTentativa(courseId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");

  const { data: prova } = await sb.from("academy_assessments")
    .select("id, tentativas_max, exige_conclusao").eq("course_id", courseId).eq("ativa", true).maybeSingle();
  if (!prova) throw new Error("Este curso ainda não tem prova disponível.");

  const { data: matricula } = await sb.from("academy_enrollments")
    .select("id").eq("course_id", courseId).eq("user_id", user.id).eq("status", "ativa").maybeSingle();
  if (!matricula) throw new Error("Você precisa de uma matrícula ativa para fazer a prova.");

  // Portão das tarefas: o curso exige as 17 concluídas antes de liberar a prova.
  if (prova.exige_conclusao) {
    const { pendentes } = await tarefasPendentes(courseId, matricula.id);
    if (pendentes > 0) {
      throw new Error(`Faltam ${pendentes} tarefa(s) da trilha para liberar a prova.`);
    }
  }

  const { data: anteriores } = await sb.from("academy_attempts")
    .select("id, numero, status").eq("enrollment_id", matricula.id).eq("assessment_id", prova.id)
    .order("numero", { ascending: false });

  const emAberto = (anteriores ?? []).find((a) => a.status === "em_andamento");
  if (emAberto) return emAberto.id;   // retomar em vez de abrir outra

  if ((anteriores ?? []).some((a) => a.status === "aprovado")) throw new Error("Você já foi aprovado nesta prova.");
  if ((anteriores ?? []).length >= prova.tentativas_max) {
    throw new Error(`Você usou as ${prova.tentativas_max} tentativas disponíveis.`);
  }

  const { data, error } = await sb.from("academy_attempts")
    .insert({ enrollment_id: matricula.id, assessment_id: prova.id, numero: (anteriores?.[0]?.numero ?? 0) + 1 })
    .select("id").single();
  if (error) throw new Error(error.message);

  await audit("academy.prova_iniciada", "academy_attempts", data.id, { course_id: courseId });
  return data.id;
}

/** Quantas tarefas da trilha ainda faltam. Usado no portão da prova e na tela. */
async function tarefasPendentes(courseId: string, enrollmentId: string) {
  const sb = await createClient();
  const { data: mods } = await sb.from("academy_modules").select("id, academy_tasks(id)").eq("course_id", courseId);
  const todas = (mods ?? []).flatMap((m) => ((m.academy_tasks as unknown as { id: string }[]) ?? []).map((t) => t.id));
  const { data: feitas } = await sb.from("academy_progress")
    .select("task_id").eq("enrollment_id", enrollmentId).not("task_id", "is", null);
  const ok = new Set((feitas ?? []).map((p) => p.task_id));
  return { total: todas.length, pendentes: todas.filter((id) => !ok.has(id)).length };
}

/**
 * Envia e corrige. Service client — precisa do gabarito e de gravar a nota.
 * A guarda de posse é a primeira coisa que roda.
 */
export async function enviarProva(attemptId: string, respostas: Record<string, string | null>) {
  const { svc, userId, tentativa, matricula } = await tentativaDoUsuario(attemptId);
  if (tentativa.status !== "em_andamento") throw new Error("Esta tentativa já foi encerrada.");

  const [{ data: prova }, { data: questoes }] = await Promise.all([
    svc.from("academy_assessments").select("id, nota_minima, course_id").eq("id", tentativa.assessment_id).single(),
    svc.from("academy_questions").select("id, ordem, tipo, enunciado").eq("assessment_id", tentativa.assessment_id).order("ordem"),
  ]);
  const { data: gabaritos } = await svc.from("academy_question_keys")
    .select("question_id, gabarito").in("question_id", (questoes ?? []).map((q) => q.id));

  const r = corrigirProva(questoes ?? [], gabaritos ?? [], respostas, prova!.nota_minima);

  // grava as respostas do aluno (ele lê as suas; o gestor não)
  const linhas = (questoes ?? []).map((q) => ({ attempt_id: attemptId, question_id: q.id, resposta: respostas[q.id] ?? null }));
  if (linhas.length) await svc.from("academy_attempt_respostas").upsert(linhas, { onConflict: "attempt_id,question_id" });

  const status = r.aprovado ? "aprovado" : "reprovado";
  const { error } = await svc.from("academy_attempts").update({
    status, nota: r.nota, acertos: r.acertos, objetivas: r.objetivas, finalizada_em: new Date().toISOString(),
  }).eq("id", attemptId);
  if (error) throw new Error(error.message);

  await audit("academy.prova_corrigida", "academy_attempts", attemptId, { nota: r.nota, status });

  let certificado: string | null = null;
  if (r.aprovado) certificado = await emitirCertificado(attemptId, userId, matricula);

  revalidatePath("/academy");
  revalidatePath("/academy/certificados");
  return { nota: r.nota, aprovado: r.aprovado, acertos: r.acertos, objetivas: r.objetivas, certificado };
}

/**
 * Emissão automática. Exige nota E todas as tarefas — a aprovação sozinha não basta,
 * é a regra que o plano fixou. Reusa o pipeline inteiro do Estúdio: buildCertificateHtml
 * → htmlToPdf → bucket privado → linha + audit.
 */
async function emitirCertificado(
  attemptId: string, userId: string,
  matricula: { id: string; org_id: string | null; course_id: string; nome: string | null; email: string | null },
): Promise<string | null> {
  const svc = createServiceClient();

  // idempotência: reenvio ou clique duplo não gera segundo certificado
  const { data: jaTem } = await svc.from("formacao_certificados")
    .select("codigo").eq("enrollment_id", matricula.id).is("deleted_at", null).maybeSingle();
  if (jaTem?.codigo) return jaTem.codigo;

  const { data: curso } = await svc.from("academy_courses")
    .select("id, titulo, carga_horaria_min, versao, brand_attribution, certificado").eq("id", matricula.course_id).single();
  if (!curso?.certificado) return null;

  const { pendentes } = await tarefasPendentesService(svc, matricula.course_id, matricula.id);
  if (pendentes > 0) return null;   // aprovado na prova mas trilha incompleta: não emite

  const nome = matricula.nome?.trim() || matricula.email?.split("@")[0] || "Aluno";
  const html = buildCertificateHtml({
    participante: nome,
    formacao: curso.titulo,
    cargaHoraria: curso.carga_horaria_min ? `${Math.round(curso.carga_horaria_min / 60)}h` : null,
    data: new Date().toLocaleDateString("pt-BR"),
    attribution: curso.brand_attribution as "salestrack" | "andre_kachan",
  });

  const pdf = await htmlToPdf(html);
  const buffer = pdf ?? Buffer.from(html);
  const ext = pdf ? "pdf" : "html";
  // aluno sem org tem caminho próprio: o padrão do Estúdio começa por org_id, que aqui pode faltar
  const path = `academy/${curso.id}/${matricula.id}-v${curso.versao}.${ext}`;
  await svc.storage.from("entregaveis").upload(path, buffer, {
    contentType: pdf ? "application/pdf" : "text/html; charset=utf-8", upsert: true,
  });

  const codigo = gerarCodigoCertificado(randomBytes(12));
  const { error } = await svc.from("formacao_certificados").insert({
    org_id: matricula.org_id, enrollment_id: matricula.id, course_id: curso.id, attempt_id: attemptId,
    user_id: userId, participante_nome: nome, participante_email: matricula.email,
    formacao_titulo: curso.titulo, course_versao: curso.versao, codigo,
    brand_attribution: curso.brand_attribution, rendered_url: path,
  });
  if (error) throw new Error(error.message);

  await svc.from("academy_enrollments")
    .update({ status: "concluida", completed_at: new Date().toISOString() }).eq("id", matricula.id);

  await audit("academy.certificado_emitido", "formacao_certificados", attemptId, { codigo, degradado: !pdf });
  return codigo;
}

/** Irmã de tarefasPendentes() para o caminho de service client (sem sessão do aluno). */
async function tarefasPendentesService(
  svc: ReturnType<typeof createServiceClient>, courseId: string, enrollmentId: string,
) {
  const { data: mods } = await svc.from("academy_modules").select("id, academy_tasks(id)").eq("course_id", courseId);
  const todas = (mods ?? []).flatMap((m) => ((m.academy_tasks as unknown as { id: string }[]) ?? []).map((t) => t.id));
  const { data: feitas } = await svc.from("academy_progress")
    .select("task_id").eq("enrollment_id", enrollmentId).not("task_id", "is", null);
  const ok = new Set((feitas ?? []).map((p) => p.task_id));
  return { total: todas.length, pendentes: todas.filter((id) => !ok.has(id)).length };
}
