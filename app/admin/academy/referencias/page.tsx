import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { CrudManager } from "@/components/crud/CrudManager";
import { listResource, resourcePermissions } from "@/lib/crud/query";

export const dynamic = "force-dynamic";

export default async function ReferenciasAdminPage() {
  const [rows, trash, can] = await Promise.all([
    listResource("academy_referencias"),
    listResource("academy_referencias", { trash: true }),
    resourcePermissions("academy_referencias"),
  ]);
  return (
    <ContentArea>
      <Breadcrumbs
        items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Estúdio", href: "/admin/estudio-area" }, { label: "Referências da Academy" }]}
        className="mb-4"
      />
      <PageHeader
        eyebrow="Academy"
        title="Biblioteca de referências"
        subtitle="Os prompts prontos, ferramentas, termos e itens de checklist que o aluno consulta. Edite aqui e o aluno vê na hora — sem publicar versão nova."
      />
      <CrudManager resourceName="academy_referencias" rows={rows} trashRows={trash} can={can} />
    </ContentArea>
  );
}
