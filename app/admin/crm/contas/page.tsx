import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CrmNav } from "@/components/crm/CrmNav";
import { ORG_PLAN_LABELS, ORG_STATUS_LABELS, type Organization } from "@/lib/types";
import { createOrg } from "./actions";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: deals }] = await Promise.all([
    supabase.from("organizations").select("*").eq("is_salestrack", false).order("created_at", { ascending: false }),
    supabase.from("deals").select("org_id").is("deleted_at", null),
  ]);
  const dealCount: Record<string, number> = {};
  (deals ?? []).forEach((d: { org_id: string | null }) => { if (d.org_id) dealCount[d.org_id] = (dealCount[d.org_id] ?? 0) + 1; });

  return (
    <ContentArea>
      <div>
        <p className="text-[13px] uppercase tracking-[.24em] text-muted2 mb-1">CRM · Organizações</p>
        <h1 className="font-serif text-4xl font-semibold mb-6">Contas</h1>
        <CrmNav />

        <details className="card p-4 mb-6">
          <summary className="cursor-pointer text-sm text-gold">+ Nova conta</summary>
          <form action={createOrg} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-52"><label className="label">Nome</label><input className="input" name="name" required /></div>
            <div className="w-40"><label className="label">CNPJ</label><input className="input font-mono" name="cnpj" /></div>
            <div className="w-40"><label className="label">Plano</label>
              <select className="input" name="plan" defaultValue="professional">
                {Object.entries(ORG_PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="w-40"><label className="label">Status</label>
              <select className="input" name="status" defaultValue="prospect">
                {Object.entries(ORG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <button className="btn-gold">Criar</button>
          </form>
        </details>

        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <th className="th">Organização</th><th className="th">Plano</th><th className="th">Status</th>
              <th className="th">Deals</th><th className="th">Criada</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {(orgs as Organization[] | null)?.map((o) => (
                <tr key={o.id} className="hover:bg-navy3/50">
                  <td className="td"><p className="text-cream">{o.name}</p>{o.cnpj && <p className="text-xs text-muted2 font-mono">{o.cnpj}</p>}</td>
                  <td className="td text-muted">{ORG_PLAN_LABELS[o.plan] ?? o.plan}</td>
                  <td className="td"><span className="badge-muted">{ORG_STATUS_LABELS[o.status] ?? o.status}</span></td>
                  <td className="td font-mono">{dealCount[o.id] ?? 0}</td>
                  <td className="td text-xs text-muted2">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="td text-right"><Link href={`/admin/crm/contas/${o.id}`} className="text-gold text-sm hover:underline">Abrir</Link></td>
                </tr>
              ))}
              {(!orgs || orgs.length === 0) && <tr><td className="td text-muted2" colSpan={6}>Nenhuma conta ainda. Converta um deal em cliente ou crie uma acima.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </ContentArea>
  );
}
