import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { EditorProva, type QuestaoAdmin } from "@/components/admin/EditorProva";

export const dynamic = "force-dynamic";

/**
 * Edição da prova pelo André, sem depender de deploy — mesma razão da tela de referências.
 * Service client porque `academy_question_keys` só é legível por admin e a tela mostra o
 * gabarito ao lado da questão; a guarda de admin é local e explícita, logo abaixo.
 */
export default async function ProvaAdminPage({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return (
      <ContentArea>
        <PageHeader eyebrow="Academy" title="Prova" subtitle="Esta tela é restrita à equipe Salestrack." />
      </ContentArea>
    );
  }

  const { curso } = await searchParams;
  const svc = createServiceClient();
  const { data: cursos } = await svc.from("academy_courses")
    .select("id, titulo").is("deleted_at", null).order("titulo");

  const courseId = curso ?? cursos?.[0]?.id ?? null;
  const cursoAtual = (cursos ?? []).find((c) => c.id === courseId);

  if (!courseId || !cursoAtual) {
    return (
      <ContentArea>
        <PageHeader eyebrow="Academy" title="Prova" subtitle="Nenhum curso cadastrado ainda." />
      </ContentArea>
    );
  }

  const { data: prova } = await svc.from("academy_assessments")
    .select("id, titulo, descricao, nota_minima, tentativas_max, exige_conclusao, ativa")
    .eq("course_id", courseId).maybeSingle();

  let questoes: QuestaoAdmin[] = [];
  if (prova) {
    const { data: qs } = await svc.from("academy_questions")
      .select("id, ordem, enunciado, tipo, alternativas").eq("assessment_id", prova.id).order("ordem");
    const { data: gs } = await svc.from("academy_question_keys")
      .select("question_id, gabarito").in("question_id", (qs ?? []).map((q) => q.id));
    const porId = new Map((gs ?? []).map((g) => [g.question_id, g.gabarito]));
    questoes = (qs ?? []).map((q) => ({
      id: q.id, ordem: q.ordem, enunciado: q.enunciado, tipo: q.tipo as "multipla" | "vf",
      alternativas: Array.isArray(q.alternativas) ? (q.alternativas as string[]) : [],
      gabarito: porId.get(q.id) ?? null,
    }));
  }

  return (
    <ContentArea>
      <Breadcrumbs
        items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Estúdio", href: "/admin/estudio-area" }, { label: "Prova da Academy" }]}
        className="mb-4"
      />
      <PageHeader
        eyebrow="Academy"
        title="Avaliação final"
        subtitle="As questões que o aluno responde ao terminar a trilha. A correção é automática e o certificado sai sozinho para quem passa — o que você escreve aqui vale na hora, sem publicar versão nova."
      />
      <EditorProva
        courseId={courseId}
        cursoTitulo={cursoAtual.titulo}
        prova={{
          id: prova?.id ?? null,
          titulo: prova?.titulo ?? "Avaliação final",
          descricao: prova?.descricao ?? "",
          notaMinima: prova?.nota_minima ?? 70,
          tentativasMax: prova?.tentativas_max ?? 3,
          exigeConclusao: prova?.exige_conclusao ?? true,
          ativa: prova?.ativa ?? true,
        }}
        questoes={questoes}
      />
    </ContentArea>
  );
}
