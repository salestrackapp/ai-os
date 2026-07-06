import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpHub } from "@/components/guidance/HelpHub";

export const dynamic = "force-dynamic";

export default function AjudaPortalPage() {
  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Portal", href: "/portal" }, { label: "Ajuda" }]} className="mb-4" />
      <PageHeader eyebrow="Central de ajuda" title="Como usar o portal"
        subtitle="Guias curtos do seu programa. Busque um tópico e abra a tela — sem complicação." />
      <HelpHub surface="portal" />
    </ContentArea>
  );
}
