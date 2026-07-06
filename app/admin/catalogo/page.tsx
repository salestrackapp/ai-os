import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_LABELS, KIND_LABELS, type CatalogItem } from "@/lib/types";
import { CatalogTable } from "@/components/CatalogTable";
import { PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

// Canônico do "Catálogo de ofertas" (consolida Catálogo + Ofertas — mesma fonte catalog_items).
// /admin/ofertas redireciona para cá. Ver docs/catalogos-vs-ofertas.md.
export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ kind?: string; brand?: string }> }) {
  const { kind, brand } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("catalog_items").select("*").is("deleted_at", null).order("brand").order("kind").order("name");
  if (kind) q = q.eq("kind", kind);
  if (brand) q = q.eq("brand", brand);
  const { data: items } = await q;

  const chip = (active: boolean) =>
    `rounded-ds-pill border px-3 py-1 font-montserrat text-[12px] transition-colors ${active ? "border-[color:var(--brand)] bg-[var(--tile)] text-[color:var(--brand-deep)]" : "border-hairline text-[color:var(--fg-3)] hover:border-[color:var(--brand-light)]"}`;

  const filters = (param: "kind" | "brand", options: Record<string, string>, current?: string) => (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/catalogo" className={chip(!current)}>Todas</Link>
      {Object.entries(options).map(([k, label]) => {
        const params = new URLSearchParams();
        if (param === "kind") { params.set("kind", k); if (brand) params.set("brand", brand); }
        else { params.set("brand", k); if (kind) params.set("kind", kind); }
        return <Link key={k} href={`/admin/catalogo?${params}`} className={chip(current === k)}>{label}</Link>;
      })}
    </div>
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Catálogo de ofertas" }]} className="mb-4" />
      <PageHeader eyebrow="Comercial" title="Catálogo de ofertas"
        subtitle="O que você vende e entrega — Diagnose, Sprint, engajamento, Mentoria, workshops. Alimenta as propostas. Não é plano de plataforma."
        comoUsar={<HelpButton routeKey="/admin/comercial" />}
        actions={
          <div className="flex items-center gap-2">
            <a href="/admin/catalogo/export" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="fileText" size={15} /> Exportar CSV</a>
            <Link href="/admin/catalogo/novo" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"><Icon name="gem" size={15} /> Nova oferta</Link>
          </div>
        } />
      <div className="mb-6 space-y-3">
        {filters("brand", BRAND_LABELS, brand)}
        {filters("kind", KIND_LABELS, kind)}
      </div>
      <CatalogTable items={(items as CatalogItem[]) ?? []} brand={brand} kind={kind} />
    </div>
  );
}
