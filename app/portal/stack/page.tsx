import { createClient } from "@/lib/supabase/server";
import { PageHeader, ContentArea } from "@/components/ds";
import { resolvePortalOrg } from "@/lib/portal";
import { saveStackEntry, deleteStackEntry } from "./actions";

export const dynamic = "force-dynamic";

const CLASS_LABELS: Record<string, string> = { publico: "Público", interno: "Interno", confidencial: "Confidencial", restrito: "Restrito" };
const CLASS_BADGE: Record<string, string> = { publico: "badge-muted", interno: "badge-muted", confidencial: "badge-gold", restrito: "badge inline-flex text-[11px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10" };

type Entry = { id: string; platform_name: string; purpose: string | null; data_classification: string; authorized_data: string | null; owner: string | null };

export default async function StackPage() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  const { data } = await supabase.from("ai_stack_entries").select("*").eq("org_id", orgId).order("platform_name");
  const list = (data as Entry[]) ?? [];

  return (
    <ContentArea>
      <div>
        <PageHeader eyebrow="Governança" title="Meu Stack de IA" />
        <p className="text-sm text-muted mb-6 max-w-2xl">Registre quais IAs sua empresa usa, para quê e <b>o que cada uma está autorizada a receber</b>. É documentação da sua governança — <b>nada aqui se conecta a nenhum sistema</b>.</p>

        <div className="card p-6 mb-6">
          <h2 className="font-serif text-lg font-semibold mb-3">+ Registrar ferramenta de IA</h2>
          <form action={saveStackEntry.bind(null, null)} className="grid sm:grid-cols-2 gap-3">
            <input name="platform_name" className="input" placeholder="Plataforma (ex.: Claude, ChatGPT, Copilot)*" required />
            <input name="purpose" className="input" placeholder="Para quê (uso)" />
            <select name="data_classification" className="input" defaultValue="interno">{Object.entries(CLASS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input name="owner" className="input" placeholder="Responsável" />
            <input name="authorized_data" className="input sm:col-span-2" placeholder="O que esta IA está autorizada a receber (ex.: dados públicos e internos, nunca dados de clientes)" />
            <button className="btn-gold sm:col-span-2">Registrar</button>
          </form>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Plataforma</th><th className="th">Uso</th><th className="th">Classificação</th><th className="th">Autorizado a receber</th><th className="th">Responsável</th><th className="th"></th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                  <td className="td text-cream">{e.platform_name}</td>
                  <td className="td text-muted text-xs">{e.purpose ?? "—"}</td>
                  <td className="td"><span className={CLASS_BADGE[e.data_classification] ?? "badge-muted"}>{CLASS_LABELS[e.data_classification] ?? e.data_classification}</span></td>
                  <td className="td text-muted text-xs max-w-xs">{e.authorized_data ?? "—"}</td>
                  <td className="td text-muted2 text-xs">{e.owner ?? "—"}</td>
                  <td className="td text-right"><form action={deleteStackEntry.bind(null, e.id)}><button className="text-muted2 hover:text-red-400 text-xs">excluir</button></form></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhuma ferramenta registrada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </ContentArea>
  );
}
