/** Programas — lista v5 com CRUD completo (kit R2.1 + regras do agregado). */
import { createClient } from "@/lib/supabase/server";
import { ContentArea, PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";
import { ProgramaManager } from "@/components/admin/ProgramaManager";
import { resourcePermissions } from "@/lib/crud/query";

export const dynamic = "force-dynamic";

export default async function ProgramasPage() {
  const supabase = await createClient();
  const [{ data: alive }, { data: trash }, can] = await Promise.all([
    supabase.from("projects").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("projects").select("*").not("deleted_at", "is", null).order("created_at", { ascending: false }),
    resourcePermissions("programa"),
  ]);
  const orgIds = [...new Set([...(alive ?? []), ...(trash ?? [])].map((p) => p.org_id).filter(Boolean))] as string[];
  const { data: orgs } = orgIds.length ? await supabase.from("organizations").select("id, name").in("id", orgIds) : { data: [] as { id: string; name: string }[] };
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  const attach = (rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, org_name: orgName[String(r.org_id)] ?? "—" }));

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Clientes", href: "/admin/clientes" }, { label: "Programas" }]} className="mb-4" />
      <PageHeader eyebrow="Clientes" title="Programas"
        subtitle="O programa de cada cliente — crie, edite a estrutura, duplique um que deu certo e exclua sem medo (sempre dá para desfazer)."
        comoUsar={<HelpButton routeKey="/admin/clientes" />} />
      <ProgramaManager rows={attach(alive ?? [])} trashRows={attach(trash ?? [])} can={can} />
    </ContentArea>
  );
}
