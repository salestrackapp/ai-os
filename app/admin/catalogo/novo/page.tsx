import { CatalogForm } from "@/components/CatalogForm";
import { createItem } from "../actions";

export default function NovoItem() {
  return <CatalogForm action={createItem} title="Novo item do catálogo" />;
}
