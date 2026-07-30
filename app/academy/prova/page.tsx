import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveLearner } from "@/lib/academy/learner";
import { Prova, type QuestaoProva } from "@/components/academy/Prova";
import { iniciarTentativa } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Prova final. A página abre (ou retoma) a tentativa e entrega as questões.
 * O gabarito NUNCA passa por aqui: `academy_question_keys` não tem policy de aluno,
 * então mesmo que esta consulta pedisse, o banco devolveria vazio.
 */
export default async function ProvaPage() {
  await resolveLearner();
  const sb = await createClient();

  const { data: matricula } = await sb.from("academy_enrollments")
    .select("id, course_id, academy_courses(titulo)").eq("status", "ativa").limit(1).maybeSingle();

  if (!matricula) return <Aviso titulo="Nenhuma matrícula ativa" texto="Você precisa estar matriculado para fazer a prova." />;

  const { data: prova } = await sb.from("academy_assessments")
    .select("id, titulo, descricao, nota_minima, tentativas_max")
    .eq("course_id", matricula.course_id).eq("ativa", true).maybeSingle();

  if (!prova) {
    return <Aviso titulo="A prova ainda não está disponível"
      texto="Assim que a avaliação deste curso for publicada, ela aparece aqui. Siga na trilha enquanto isso." />;
  }

  let attemptId: string;
  try {
    attemptId = await iniciarTentativa(matricula.course_id);
  } catch (e) {
    return <Aviso titulo="Prova indisponível" texto={(e as Error).message} />;
  }

  const { data: questoes } = await sb.from("academy_questions")
    .select("id, ordem, enunciado, tipo, alternativas").eq("assessment_id", prova.id).order("ordem");

  const curso = matricula.academy_courses as unknown as { titulo: string } | null;

  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">{curso?.titulo ?? "Salestrack AI Academy"}</p>
        <h1 className="acad-h1">{prova.titulo}</h1>
        <p className="acad-sub">
          {prova.descricao ?? `Responda todas as questões e envie. A correção é automática e a nota mínima é ${prova.nota_minima}%.`}
        </p>
      </header>
      <Prova attemptId={attemptId} notaMinima={prova.nota_minima}
        questoes={(questoes ?? []).map((q) => ({
          id: q.id, ordem: q.ordem, enunciado: q.enunciado, tipo: q.tipo,
          alternativas: Array.isArray(q.alternativas) ? (q.alternativas as string[]) : [],
        })) as QuestaoProva[]} />
    </>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <header className="mb-6">
        <p className="acad-eyebrow">Salestrack AI Academy</p>
        <h1 className="acad-h1">Avaliação</h1>
      </header>
      <div className="acad-card p-8 text-center">
        <p className="text-[15px] font-bold text-[color:var(--navy)]">{titulo}</p>
        <p className="mt-1.5 text-[14px] text-[color:var(--acad-muted)]">{texto}</p>
        <Link href="/academy/trilha" className="acad-btn-cyan mt-4 inline-block">Ir para a trilha</Link>
      </div>
    </>
  );
}
