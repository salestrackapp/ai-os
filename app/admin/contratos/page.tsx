import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_STATUS_LABELS, contractStatusBadge, type Contract } from "@/lib/types";
import { PageHeader, ContentArea } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const supabase = await createClient();
  const { data: contracts } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
  const list = (contracts as Contract[]) ?? [];
  const orgIds = [...new Set(list.map((c) => c.org_id).filter(Boolean))] as string[];
  const { data: orgs } = orgIds.length ? await supabase.from("organizations").select("id, name").in("id", orgIds) : { data: [] as { id: string; name: string }[] };
  const orgName: Record<string, string> = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));

  return (
    <ContentArea>
      <div>
        <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Contratos" }]} className="mb-4" />
        <PageHeader eyebrow="Comercial · fechar" title="Contratos"
          subtitle="Minutas, assinatura e kickoff — a partir de propostas aprovadas."
          comoUsar={<HelpButton routeKey="/admin/comercial" />} />
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <th className="th">Cliente</th><th className="th">Status</th><th className="th">Assinado em</th><th className="th">Criado</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-navy3/50">
                  <td className="td text-cream">{c.org_id ? (orgName[c.org_id] ?? "—") : (c.signer_name ?? "—")}</td>
                  <td className="td"><span className={contractStatusBadge(c.status)}>{CONTRACT_STATUS_LABELS[c.status] ?? c.status}</span>{c.signed_manually && c.status === "assinado" && <span className="text-[11px] text-muted2 ml-1">manual</span>}</td>
                  <td className="td text-xs text-muted2">{c.signed_at ? new Date(c.signed_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="td text-xs text-muted2">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="td text-right"><Link href={`/admin/contratos/${c.id}`} className="text-gold text-sm hover:underline">Abrir</Link></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td className="td text-muted2" colSpan={5}>Nenhum contrato. Gere um a partir de uma proposta aprovada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </ContentArea>
  );
}
