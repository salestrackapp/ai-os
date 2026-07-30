import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailMap } from "@/lib/supabase/admin";
import { CatalogForm } from "@/components/CatalogForm";
import { ServiceDescription } from "@/components/ServiceDescription";
import { updateItem, deleteItem } from "../actions";
import type { CatalogItem } from "@/lib/types";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

function summarizePayload(p: Record<string, unknown> | null): string {
  if (!p) return "";
  const bits: string[] = [];
  if (p.name != null) bits.push(`nome: ${p.name}`);
  if (p.price != null) bits.push(`preço: ${p.price}`);
  if (p.needs_review != null) bits.push(`revisar: ${p.needs_review ? "sim" : "não"}`);
  if (p.active != null) bits.push(`ativo: ${p.active ? "sim" : "não"}`);
  if (p.ids) bits.push(`${(p.ids as unknown[]).length} itens em lote`);
  return bits.join(" · ");
}

export default async function EditarItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase.from("catalog_items").select("*").eq("id", id).single();
  if (!item) notFound();

  const { data: history } = await supabase.from("audit_logs")
    .select("id, action, payload, actor_id, created_at")
    .eq("resource", "catalog_items").eq("resource_id", id)
    .order("created_at", { ascending: false }).limit(50);
  const emails = await emailMap((history ?? []).map((h) => h.actor_id));

  const update = updateItem.bind(null, id);
  const remove = deleteItem.bind(null, id);

  return (
    <ContentArea>
      <div>
        <CatalogForm item={item as CatalogItem} action={update} title="Editar item" />
        <div className="max-w-2xl mt-4 space-y-4">
          <div className="card p-6">
            <p className="label mb-3">Prévia da descrição</p>
            <ServiceDescription text={(item as CatalogItem).description} />
          </div>
          <form action={remove}>
            <button className="btn-ghost text-xs !text-muted2 hover:!text-cream">Excluir item (registrado em auditoria)</button>
          </form>

          <div className="card p-6">
            <p className="label mb-4">Histórico (auditoria deste item)</p>
            <ul className="space-y-3">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex items-baseline gap-3 text-sm">
                  <span className="text-[13px] text-muted2 w-32 shrink-0">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  <span className="badge-muted shrink-0">{h.action.replace("catalog.", "")}</span>
                  <div className="flex-1">
                    <span className="text-muted2">{h.actor_id ? (emails[h.actor_id] ?? "sistema") : "sistema"}</span>
                    {summarizePayload(h.payload as Record<string, unknown> | null) && <span className="text-muted"> — {summarizePayload(h.payload as Record<string, unknown> | null)}</span>}
                  </div>
                </li>
              ))}
              {(!history || history.length === 0) && <li className="text-sm text-muted2">Sem histórico registrado ainda.</li>}
            </ul>
          </div>
        </div>
      </div>
    </ContentArea>
  );
}
