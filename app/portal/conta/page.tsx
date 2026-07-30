/** Portal · Minha conta (U4) — dados + financeiro + acesso, escopo da própria org. */
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { resolvePortalOrg } from "@/lib/portal";
import { ContentArea, PageHeader, Card, Kpi, Badge, EmptyState } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { brl } from "@/lib/types";

export const dynamic = "force-dynamic";
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default async function MinhaConta() {
  const ctx = await resolvePortalOrg();
  const orgId = ctx?.orgId ?? null;
  if (!orgId) return <ContentArea><PageHeader eyebrow="Minha conta" title="Conta" /><Card><EmptyState icon={<Icon name="settings" size={22} />} title="Sem acesso" description="Faça login para ver sua conta." /></Card></ContentArea>;

  const sb = createServiceClient();
  const [{ data: org }, { data: contato }, { data: invoices }, { data: subscription }, { data: mems }] = await Promise.all([
    sb.from("organizations").select("name, cnpj").eq("id", orgId).maybeSingle(),
    sb.from("contacts").select("name, email, phone").eq("org_id", orgId).order("created_at").limit(1).maybeSingle(),
    sb.from("invoices").select("amount, status, due_date, kind, installment_n, installments_total").eq("org_id", orgId).order("due_date"),
    sb.from("subscriptions").select("monthly_amount, status").eq("org_id", orgId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("memberships").select("email, role").eq("org_id", orgId),
  ]);
  const emAberto = (invoices ?? []).filter((i) => i.status !== "paga").reduce((a, i) => a + (Number(i.amount) || 0), 0);

  return (
    <ContentArea>
      <PageHeader eyebrow="Minha conta" title={org?.name ?? "Conta"} subtitle="Seus dados, o financeiro e quem acessa o portal do seu lado." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados */}
        <Card>
          <p className="ds-eyebrow mb-3">Dados</p>
          <dl className="space-y-2 font-montserrat text-[13.5px]">
            <div className="flex justify-between gap-3"><dt className="text-[color:var(--fg-3)]">Empresa</dt><dd className="text-[color:var(--fg-1)]">{org?.name ?? "—"}</dd></div>
            {org?.cnpj && <div className="flex justify-between gap-3"><dt className="text-[color:var(--fg-3)]">CNPJ</dt><dd className="text-[color:var(--fg-1)]">{org.cnpj}</dd></div>}
            <div className="flex justify-between gap-3"><dt className="text-[color:var(--fg-3)]">Contato</dt><dd className="text-[color:var(--fg-1)]">{contato?.name ?? "—"}</dd></div>
            {contato?.email && <div className="flex justify-between gap-3"><dt className="text-[color:var(--fg-3)]">E-mail</dt><dd className="text-[color:var(--fg-1)]">{contato.email}</dd></div>}
            {contato?.phone && <div className="flex justify-between gap-3"><dt className="text-[color:var(--fg-3)]">WhatsApp</dt><dd className="text-[color:var(--fg-1)]">{contato.phone}</dd></div>}
          </dl>
        </Card>

        {/* Acesso */}
        <Card>
          <div className="mb-3 flex items-center justify-between"><p className="ds-eyebrow !mb-0">Quem acessa</p><Link href="/portal/equipe" className="font-montserrat text-[13px] font-semibold text-[color:var(--brand)] hover:underline">Gerenciar →</Link></div>
          {(mems ?? []).length === 0 ? <p className="ds-small">Só você por enquanto.</p> : (
            <ul className="space-y-2">{(mems ?? []).map((mm, i) => <li key={i} className="flex items-center justify-between gap-2"><span className="font-montserrat text-[14px] text-[color:var(--fg-1)]">{mm.email ?? "—"}</span><Badge tone="neutral">{mm.role}</Badge></li>)}</ul>
          )}
        </Card>
      </div>

      {/* Financeiro */}
      <div className="mt-6">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Kpi value={subscription ? brl(Number(subscription.monthly_amount) || 0) : "—"} label={subscription ? `Mensalidade · ${subscription.status}` : "Sem assinatura"} />
          <Kpi value={brl(emAberto)} label="Em aberto" />
          <Kpi value={String((invoices ?? []).length)} label="Faturas" />
        </div>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-hairline px-4 py-2.5"><p className="ds-eyebrow !mb-0">Faturas</p></div>
          {(invoices ?? []).length === 0 ? <p className="px-4 py-4 ds-small">Nenhuma fatura.</p> : (
            <div className="overflow-x-auto"><table className="w-full border-collapse">
              <thead><tr className="border-b border-hairline">{["Tipo", "Parcela", "Vencimento", "Status", "Valor"].map((h) => <th key={h} className="px-4 py-2.5 text-left font-jbmono text-[13px] uppercase tracking-[.08em] text-[color:var(--fg-3)]">{h}</th>)}</tr></thead>
              <tbody>{(invoices ?? []).map((i, idx) => (
                <tr key={idx} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2.5 font-montserrat text-[14px] text-[color:var(--fg-1)]">{i.kind === "manutencao" ? "Manutenção" : "Implantação"}</td>
                  <td className="px-4 py-2.5 font-jbmono text-[13px] text-[color:var(--fg-3)]">{i.installment_n ? `${i.installment_n}/${i.installments_total ?? "—"}` : "—"}</td>
                  <td className="px-4 py-2.5 font-jbmono text-[13px] text-[color:var(--fg-2)]">{fmt(i.due_date)}</td>
                  <td className="px-4 py-2.5"><Badge tone={i.status === "paga" ? "success" : i.status === "atrasada" ? "danger" : "warn"}>{i.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right font-jbmono text-[13px] text-[color:var(--fg-1)]">{brl(Number(i.amount) || 0)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
    </ContentArea>
  );
}
