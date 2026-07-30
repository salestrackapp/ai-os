/** Criar programa — 3 origens: negócio ganho / template (wizard Fase 8) ou em branco. */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { BlankProgramForm } from "@/components/admin/BlankProgramForm";

export const dynamic = "force-dynamic";

export default async function NovoProgramaPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase.from("organizations").select("id, name").eq("is_salestrack", false).order("name");

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Programas", href: "/admin/programas" }, { label: "Novo" }]} className="mb-4" />
      <PageHeader eyebrow="Clientes" title="Novo programa" subtitle="Escolha como o programa nasce. Todas as origens terminam num programa editável." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Link href="/admin/onboarding/novo" className="group block">
          <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[color:rgba(0, 122, 148,0.28)] group-hover:shadow-ds-md"
            icon={<Icon name="layers" size={20} />} eyebrow="Recomendado" title="A partir de um template ou negócio">
            Parte de um blueprint (Fase 9) ou de um negócio ganho — o motor de provisionamento monta a estrutura pronta.
            <span className="mt-3 inline-flex items-center gap-1 font-montserrat text-[13px] font-semibold text-[color:var(--brand)]">Abrir provisionamento →</span>
          </Card>
        </Link>

        <Card icon={<Icon name="pen" size={20} />} eyebrow="Do zero" title="Em branco">
          <p className="mb-4">Cria o esqueleto mínimo e você monta a estrutura no editor.</p>
          <BlankProgramForm orgs={(orgs as { id: string; name: string }[]) ?? []} />
        </Card>
      </div>
    </ContentArea>
  );
}
