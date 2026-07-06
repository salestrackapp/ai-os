import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpHub } from "@/components/guidance/HelpHub";

export const dynamic = "force-dynamic";

export default function AjudaAdminPage() {
  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Ajuda" }]} className="mb-4" />
      <PageHeader eyebrow="Central de ajuda" title="Como usar o AI OS"
        subtitle="Todos os guias em um só lugar. Busque um tópico e abra a tela — em linguagem simples, sem jargão." />
      <HelpHub surface="admin" />
    </ContentArea>
  );
}
