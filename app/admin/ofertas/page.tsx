// Consolidado (PROMPT REV dirigido): "Ofertas" e "Catálogo" eram a MESMA fonte (catalog_items).
// A rota canônica única é /admin/catalogo ("Catálogo de ofertas"). Esta rota redireciona — nada
// apagado, reversível. Ver docs/catalogos-vs-ofertas.md.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OfertasPage() {
  redirect("/admin/catalogo");
}
