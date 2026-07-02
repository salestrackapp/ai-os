import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_LABELS, KIND_LABELS, type CatalogItem } from "@/lib/types";
import { CatalogTable } from "@/components/CatalogTable";

export const dynamic = "force-dynamic";

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ kind?: string; brand?: string }> }) {
  const { kind, brand } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("catalog_items").select("*").order("brand").order("kind").order("name");
  if (kind) q = q.eq("kind", kind);
  if (brand) q = q.eq("brand", brand);
  const { data: items } = await q;

  const filters = (param: "kind" | "brand", options: Record<string, string>, current?: string) => (
    <div className="flex gap-2 flex-wrap">
      <Link href="/admin/catalogo" className={`badge-muted ${!current ? "!text-gold !border-goldline" : ""}`}>Todos</Link>
      {Object.entries(options).map(([k, label]) => {
        const params = new URLSearchParams();
        if (param === "kind") { params.set("kind", k); if (brand) params.set("brand", brand); }
        else { params.set("brand", k); if (kind) params.set("kind", kind); }
        return (
          <Link key={k} href={`/admin/catalogo?${params}`}
            className={`badge-muted ${current === k ? "!text-gold !border-goldline" : ""}`}>{label}</Link>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Repositório-mestre</p>
        <h1 className="font-serif text-4xl font-semibold">Catálogo AK + Salestrack</h1>
      </div>
      <div className="space-y-3 mb-6">
        {filters("brand", BRAND_LABELS, brand)}
        {filters("kind", KIND_LABELS, kind)}
      </div>
      <CatalogTable items={(items as CatalogItem[]) ?? []} brand={brand} kind={kind} />
    </div>
  );
}
