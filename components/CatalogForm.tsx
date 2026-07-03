import { BRAND_LABELS, KIND_LABELS, type CatalogItem } from "@/lib/types";
import { FrentesInput } from "@/components/FrentesInput";
import { ServiceContentEditor } from "@/components/ServiceContentEditor";

export function CatalogForm({ item, action, title }: {
  item?: CatalogItem;
  action: (formData: FormData) => Promise<void>;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Catálogo</p>
      <h1 className="font-serif text-4xl font-semibold mb-8">{title}</h1>
      <form action={action} className="card p-8 space-y-5">
        <div>
          <label className="label">Nome</label>
          <input className="input" name="name" defaultValue={item?.name} required />
        </div>
        <div className="border-y border-line py-5">
          <p className="text-[11px] uppercase tracking-[.2em] text-gold mb-3">Conteúdo do serviço</p>
          <ServiceContentEditor defaultValue={item?.description ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Marca</label>
            <select className="input" name="brand" defaultValue={item?.brand ?? "andre_kachan"}>
              {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" name="kind" defaultValue={item?.kind ?? "produto"}>
              {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Unidade</label>
            <select className="input" name="unit" defaultValue={item?.unit ?? "un"}>
              <option value="un">un</option><option value="mes">mês</option>
              <option value="hora">hora</option><option value="sessao">sessão</option>
            </select>
          </div>
          <div>
            <label className="label">Preço (R$)</label>
            <input className="input font-mono" name="price" defaultValue={item?.price ?? ""} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Custo (R$)</label>
            <input className="input font-mono" name="cost" defaultValue={item?.cost ?? ""} placeholder="0,00" />
          </div>
        </div>
        <div>
          <label className="label">Frentes (consumidas pelo gerador de propostas na F2)</label>
          <FrentesInput defaultValue={item?.frentes ?? []} />
        </div>
        <div>
          <label className="label">Notas internas</label>
          <textarea className="input" name="internal_notes" rows={2} defaultValue={item?.internal_notes ?? ""} placeholder="Visível só para a equipe Salestrack" />
        </div>
        <div className="flex gap-8 pt-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="accent-[#C89B3C]" /> Ativo
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="needs_review" defaultChecked={item?.needs_review ?? false} className="accent-[#C89B3C]" /> Preço a revisar
          </label>
        </div>
        <div className="pt-4 flex gap-3">
          <button className="btn-gold">Salvar</button>
          <a href="/admin/catalogo" className="btn-ghost">Cancelar</a>
        </div>
      </form>
    </div>
  );
}
