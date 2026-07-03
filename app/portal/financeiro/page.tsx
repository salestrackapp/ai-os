import { createClient } from "@/lib/supabase/server";
import { resolvePortalOrg } from "@/lib/portal";
import { brl, type Invoice, type Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortalFinanceiro() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const supabase = await createClient();
  const [{ data: invs }, { data: subs }] = await Promise.all([
    supabase.from("invoices").select("*").eq("org_id", orgId).order("due_date", { nullsFirst: false }),
    supabase.from("subscriptions").select("*").eq("org_id", orgId).eq("status", "ativa"),
  ]);
  const invoices = (invs as Invoice[]) ?? [];
  const subscriptions = (subs as Subscription[]) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const mrr = subscriptions.reduce((a, s) => a + (s.monthly_amount ?? 0), 0);

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Somente leitura</p>
      <h1 className="font-serif text-4xl font-semibold mb-6">Financeiro</h1>

      {subscriptions.length > 0 && (
        <div className="card p-6 mb-6 border-goldline">
          <p className="label">Plataforma AI OS · mensalidade ativa</p>
          <p className="font-serif text-3xl text-gold mt-1">{brl(mrr)}<span className="text-sm text-muted2">/mês</span></p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <p className="label px-4 pt-4">Faturas</p>
        <table className="w-full">
          <thead><tr><th className="th">Tipo</th><th className="th">Parcela</th><th className="th text-right">Valor</th><th className="th">Vencimento</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {invoices.map((i) => {
              const overdue = i.status !== "paga" && i.due_date && i.due_date < today;
              return (
                <tr key={i.id} className="hover:bg-navy3/50">
                  <td className="td text-muted capitalize">{i.kind}</td>
                  <td className="td font-mono text-xs">{i.installment_n ? `${i.installment_n}/${i.installments_total ?? "?"}` : "—"}</td>
                  <td className="td text-right font-mono">{brl(i.amount)}</td>
                  <td className={`td text-xs ${overdue ? "text-amber-400" : "text-muted2"}`}>{i.due_date ? new Date(i.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="td"><span className={i.status === "paga" ? "badge-teal" : overdue ? "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-amber-400 border-amber-500/40 bg-amber-500/10" : "badge-muted"}>{i.status === "paga" ? "paga" : overdue ? "atrasada" : "aberta"}</span></td>
                  <td className="td text-right">{i.hosted_url && <a href={i.hosted_url} target="_blank" className="text-gold text-xs hover:underline">Pagar ↗</a>}</td>
                </tr>
              );
            })}
            {invoices.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhuma fatura.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
