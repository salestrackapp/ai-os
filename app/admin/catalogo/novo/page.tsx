import { ContentArea } from "@/components/ds";
import { CatalogForm } from "@/components/CatalogForm";
import { createItem } from "../actions";

export default function NovoItem() {
  return (
    <ContentArea>
      <CatalogForm action={createItem} title="Novo item do catálogo" />
    </ContentArea>
  );
}
