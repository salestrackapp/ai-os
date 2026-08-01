import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { Incidentes, type IncidenteLinha } from "@/components/admin/Incidentes";

export const dynamic = "force-dynamic";

export default async function IncidentesPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Segurança" title="Incidentes"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const { data } = await svc.from("incidentes_seguranca")
    .select("id, titulo, descricao, severidade, status, detectado_em, encerrado_em, dados_afetados, causa, acoes, risco_relevante, justificativa_risco, anpd_notificada_em, titulares_notificados_em")
    // Em andamento primeiro, e dentro disso o mais antigo no topo: é o que está há mais tempo sem
    // resposta que corre risco de estourar o prazo, não o que acabou de chegar.
    .order("encerrado_em", { ascending: true, nullsFirst: true })
    .order("detectado_em", { ascending: true });

  const incidentes: IncidenteLinha[] = (data ?? []).map((i) => ({
    id: i.id, titulo: i.titulo, descricao: i.descricao, severidade: i.severidade, status: i.status,
    detectadoEm: i.detectado_em, encerradoEm: i.encerrado_em,
    dadosAfetados: i.dados_afetados, causa: i.causa, acoes: i.acoes,
    riscoRelevante: i.risco_relevante, justificativaRisco: i.justificativa_risco,
    anpdEm: i.anpd_notificada_em, titularesEm: i.titulares_notificados_em,
  }));

  return (
    <ContentArea>
      <Breadcrumbs items={[
        { label: "Admin", href: "/admin/hoje" },
        { label: "Configurar", href: "/admin/configuracoes" },
        { label: "Dados pessoais", href: "/admin/lgpd" },
        { label: "Incidentes" },
      ]} className="mb-4" />
      <PageHeader
        eyebrow="Segurança · LGPD art. 48"
        title="Incidentes de segurança"
        subtitle="O que aconteceu, quando soubemos e quando comunicamos. A lei manda comunicar em prazo razoável — e a pergunta que vem depois nunca é “vocês tinham procedimento?”, é “quando vocês souberam?”."
      />
      <Incidentes incidentes={incidentes} />
    </ContentArea>
  );
}
