import { createClient } from "@/lib/supabase/server";
import { brl, type Invoice, type Subscription } from "@/lib/types";
import { createManualInvoice, markInvoicePaid, createManualSubscription, cancelSubscription } from "./actions";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const [{ data: subs }, { data: invs }, { data: orgs }] = await Promise.all([
    supabase.from("subscriptions").select("*").order("started_at", { ascending: false }),
    supabase.from("invoices").select("*").order("due_date", { nullsFirst: false }),
    supabase.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
  ]);
  const subscriptions = (subs as Subscription[]) ?? [];
  const invoices = (invs as Invoice[]) ?? [];
  const orgName: Record<string, string> = Object.fromEntries(((orgs as { id: string; name: string }[]) ?? []).map((o) => [o.id, o.name]));
  const today = new Date().toISOString().slice(0, 10);

  const mrr = subscriptions.filter((s) => s.status === "ativa").reduce((a, s) => a + (s.monthly_amount ?? 0), 0);
  const open = invoices.filter((i) => i.status !== "paga");
  const aReceber = open.reduce((a, i) => a + (i.amount ?? 0), 0);
  const atraso = open.filter((i) => i.due_date && i.due_date < today);
  const atrasoTotal = atraso.reduce((a, i) => a + (i.amount ?? 0), 0);
  const clientesAtivos = new Set(subscriptions.filter((s) => s.status === "ativa").map((s) => s.org_id)).size;

  const cards = [
    { label: "MRR", value: brl(mrr), note: "assinaturas ativas" },
    { label: "A receber", value: brl(aReceber), note: `${open.length} faturas em aberto` },
    { label: "Em atraso", value: brl(atrasoTotal), note: `${atraso.length} faturas`, warn: atraso.length > 0 },
    { label: "Clientes ativos", value: String(clientesAtivos), note: "com assinatura" },
  ];

  return (
    <div>
      <div className="mb-8"><p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Fechar · billing</p><h1 className="font-serif text-4xl font-semibold">Financeiro</h1></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {cards.map((c) => (
          <div key={c.label} className={`card p-6 ${c.warn ? "border-amber-500/50" : ""}`}>
            <p className="label">{c.label}</p>
            <p className={`font-serif text-3xl font-semibold mt-1 ${c.warn ? "text-amber-400" : "text-gold"}`}>{c.value}</p>
            <p className="mt-2 text-xs text-muted">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <details className="card p-4 flex-1 min-w-72">
          <summary className="cursor-pointer text-sm text-gold">+ Registrar fatura manual</summary>
          <form action={createManualInvoice} className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Conta</label><select className="input" name="org_id" required><option value="">—</option>{(orgs as { id: string; name: string }[] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label className="label">Tipo</label><select className="input" name="kind"><option value="mensalidade">Mensalidade</option><option value="implantacao">Implantação</option></select></div>
            <div><label className="label">Valor</label><input className="input font-mono" name="amount" placeholder="R$" /></div>
            <div><label className="label">Vencimento</label><input className="input" type="date" name="due_date" /></div>
            <div className="grid grid-cols-2 gap-2"><input className="input font-mono" name="installment_n" placeholder="Parc. nº" /><input className="input font-mono" name="installments_total" placeholder="de" /></div>
            <button className="btn-gold col-span-2">Registrar</button>
          </form>
        </details>
        <details className="card p-4 flex-1 min-w-72">
          <summary className="cursor-pointer text-sm text-gold">+ Registrar assinatura manual</summary>
          <form action={createManualSubscription} className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Conta</label><select className="input" name="org_id" required><option value="">—</option>{(orgs as { id: string; name: string }[] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label className="label">Plano</label><select className="input" name="plan"><option value="essential">Essential</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></div>
            <div><label className="label">Mensalidade</label><input className="input font-mono" name="monthly_amount" placeholder="R$/mês" /></div>
            <button className="btn-gold col-span-2">Registrar</button>
          </form>
        </details>
      </div>

      <div className="card overflow-x-auto mb-6">
        <p className="label px-4 pt-4">Assinaturas</p>
        <table className="w-full">
          <thead><tr><th className="th">Conta</th><th className="th">Plano</th><th className="th text-right">Mensal</th><th className="th">Status</th><th className="th">Início</th><th className="th"></th></tr></thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id} className="hover:bg-navy3/50">
                <td className="td text-cream">{s.org_id ? (orgName[s.org_id] ?? "—") : "—"}</td>
                <td className="td text-muted">{s.plan}</td>
                <td className="td text-right font-mono">{brl(s.monthly_amount)}</td>
                <td className="td"><span className={s.status === "ativa" ? "badge-teal" : "badge-muted"}>{s.status}</span></td>
                <td className="td text-xs text-muted2">{new Date(s.started_at).toLocaleDateString("pt-BR")}</td>
                <td className="td text-right">{s.status === "ativa" && <form action={cancelSubscription.bind(null, s.id)}><button className="text-muted2 hover:text-red-400 text-xs">cancelar</button></form>}</td>
              </tr>
            ))}
            {subscriptions.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Sem assinaturas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <p className="label px-4 pt-4">Faturas</p>
        <table className="w-full">
          <thead><tr><th className="th">Conta</th><th className="th">Tipo</th><th className="th">Parcela</th><th className="th text-right">Valor</th><th className="th">Vencimento</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {invoices.map((i) => {
              const overdue = i.status !== "paga" && i.due_date && i.due_date < today;
              return (
                <tr key={i.id} className="hover:bg-navy3/50">
                  <td className="td text-cream">{i.org_id ? (orgName[i.org_id] ?? "—") : "—"}</td>
                  <td className="td text-muted">{i.kind}</td>
                  <td className="td font-mono text-xs">{i.installment_n ? `${i.installment_n}/${i.installments_total ?? "?"}` : "—"}</td>
                  <td className="td text-right font-mono">{brl(i.amount)}</td>
                  <td className={`td text-xs ${overdue ? "text-amber-400" : "text-muted2"}`}>{i.due_date ? new Date(i.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="td"><span className={i.status === "paga" ? "badge-teal" : overdue ? "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-amber-400 border-amber-500/40 bg-amber-500/10" : "badge-muted"}>{i.status === "paga" ? "paga" : overdue ? "atrasada" : "aberta"}</span></td>
                  <td className="td text-right whitespace-nowrap">
                    {i.hosted_url && <a href={i.hosted_url} target="_blank" className="text-gold text-xs hover:underline mr-3">Stripe ↗</a>}
                    {i.status !== "paga" && <form action={markInvoicePaid.bind(null, i.id)} className="inline"><button className="text-teal text-xs hover:underline">marcar paga</button></form>}
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && <tr><td className="td text-muted2" colSpan={7}>Sem faturas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
