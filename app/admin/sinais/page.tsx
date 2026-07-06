/**
 * Referência do CRUD kit (R2.1) — sinais de prospecção com create/editar/duplicar/excluir + undo.
 * Prova viva do padrão: a tela toda nasce de `signalsResource` + <CrudManager>.
 */
import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";
import { CrudManager } from "@/components/crud/CrudManager";
import { listResource, resourcePermissions } from "@/lib/crud/query";

export const dynamic = "force-dynamic";

export default async function SinaisPage() {
  const [rows, trash, can] = await Promise.all([
    listResource("signals"),
    listResource("signals", { trash: true }),
    resourcePermissions("signals"),
  ]);
  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Sinais de prospecção" }]} className="mb-4" />
      <PageHeader eyebrow="Comercial" title="Sinais de prospecção"
        subtitle="Os gatilhos que somam no score de um prospect. Crie, edite, duplique e exclua — sempre dá para desfazer."
        comoUsar={<HelpButton routeKey="/admin/comercial" />} />
      <CrudManager resourceName="signals" rows={rows} trashRows={trash} can={can} />
    </ContentArea>
  );
}
