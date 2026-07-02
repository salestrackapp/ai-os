import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_LABELS, KIND_LABELS, brl, type CatalogItem } from "@/lib/types";

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
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Repositório-mestre</p>
          <h1 className="font-serif text-4xl font-semibold">Catálogo AK + Salestrack</h1>
        </div>
        <Link href="/admin/catalogo/novo" className="btn-gold">+ Novo item</Link>
      </div>
      <div className="space-y-3 mb-6">
        {filters("brand", BRAND_LABELS, brand)}
        {filters("kind", KIND_LABELS, kind)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Item</th><th className="th">Marca</th><th className="th">Tipo</th>
            <th className="th">Unidade</th><th className="th">Preço</th><th className="th">Status</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {(items as CatalogItem[] | null)?.map((it) => (
              <tr key={it.id} className="hover:bg-navy3/50">
                <td className="td">
                  <p className="text-cream">{it.name}</p>
                  {it.description && <p className="text-xs text-muted2 mt-0.5 max-w-md">{it.description}</p>}
                </td>
                <td className="td"><span className={it.brand === "andre_kachan" ? "badge-gold" : "badge-teal"}>{BRAND_LABELS[it.brand]}</span></td>
                <td className="td text-muted">{KIND_LABELS[it.kind] ?? it.kind}</td>
                <td className="td font-mono text-xs text-muted">{it.unit}</td>
                <td className="td font-mono text-sm">{brl(it.price)}</td>
                <td className="td">
                  {it.needs_review && <span className="badge-gold">Revisar preço</span>}
                  {!it.active && <span className="badge-muted ml-1">Inativo</span>}
                </td>
                <td className="td text-right"><Link href={`/admin/catalogo/${it.id}`} className="text-gold text-sm hover:underline">Editar</Link></td>
              </tr>
            ))}
            {(!items || items.length === 0) && (
              <tr><td className="td text-muted2" colSpan={7}>Nenhum item — rode as migrations de seed ou crie o primeiro item.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
