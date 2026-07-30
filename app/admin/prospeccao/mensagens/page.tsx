import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { conversasSobreIa } from "@/lib/prospecting/mensagens-linkedin";
import { MensagensLinkedIn } from "@/components/admin/MensagensLinkedIn";

export const dynamic = "force-dynamic";

export default async function MensagensPage() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) {
    return <ContentArea><PageHeader eyebrow="Prospecção" title="Suas mensagens do LinkedIn"
      subtitle="Esta tela é restrita à equipe Salestrack." /></ContentArea>;
  }

  const svc = createServiceClient();
  const [{ count: total }, { count: sobreIa }, conversas] = await Promise.all([
    svc.from("linkedin_mensagens").select("id", { count: "exact", head: true }),
    svc.from("linkedin_mensagens").select("id", { count: "exact", head: true }).eq("tema_ia", true),
    conversasSobreIa(),
  ]);

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Prospecção", href: "/admin/prospeccao" }, { label: "Suas mensagens" }]} className="mb-4" />
      <PageHeader
        eyebrow="Prospecção"
        title="Suas mensagens do LinkedIn"
        subtitle="Quem escreveu para você sobre IA. É o gesto mais deliberado que existe antes de marcar uma reunião — e são conversas suas, não de terceiros."
      />
      <MensagensLinkedIn conversas={conversas} total={total ?? 0} sobreIa={sobreIa ?? 0} />
    </ContentArea>
  );
}
