import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CatalogForm } from "@/components/CatalogForm";
import { updateItem, deleteItem } from "../actions";
import type { CatalogItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditarItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase.from("catalog_items").select("*").eq("id", id).single();
  if (!item) notFound();

  const update = updateItem.bind(null, id);
  const remove = deleteItem.bind(null, id);

  return (
    <div>
      <CatalogForm item={item as CatalogItem} action={update} title="Editar item" />
      <form action={remove} className="max-w-2xl mt-4">
        <button className="btn-ghost text-xs !text-muted2 hover:!text-cream">Excluir item (registrado em auditoria)</button>
      </form>
    </div>
  );
}
