import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROPOSAL_STATUS_LABELS, proposalStatusBadge, proposalTotals, brl, type Proposal, type ProposalItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PropostasPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("proposals").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  let proposals = (data as Proposal[]) ?? [];
  if (q) proposals = proposals.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()) || (p.client_name ?? "").toLowerCase().includes(q.toLowerCase()));

  // última leitura por proposta
  const ids = proposals.map((p) => p.id);
  const { data: evs } = ids.length ? await supabase.from("proposal_events").select("proposal_id, created_at").in("proposal_id", ids).in("kind", ["viewed", "section_read"]).order("created_at", { ascending: false }) : { data: [] as { proposal_id: string; created_at: string }[] };
  const lastRead: Record<string, string> = {};
  (evs ?? []).forEach((e) => { if (!lastRead[e.proposal_id]) lastRead[e.proposal_id] = e.created_at; });

  const statuses = Object.keys(PROPOSAL_STATUS_LABELS);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[.24em] text-muted2 mb-1">Motor comercial</p>
          <h1 className="font-serif text-4xl font-semibold">Propostas</h1>
        </div>
        <Link href="/admin/propostas/nova" className="btn-gold">+ Nova proposta</Link>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        <Link href="/admin/propostas" className={`badge-muted ${!status ? "!text-gold !border-goldline" : ""}`}>Todas</Link>
        {statuses.map((s) => <Link key={s} href={`/admin/propostas?status=${s}`} className={`badge-muted ${status === s ? "!text-gold !border-goldline" : ""}`}>{PROPOSAL_STATUS_LABELS[s]}</Link>)}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Proposta</th><th className="th">Cliente</th><th className="th">Versão</th>
            <th className="th">Status</th><th className="th text-right">Total</th><th className="th">Última leitura</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {proposals.map((p) => {
              const { total } = proposalTotals((p.items as ProposalItem[]) ?? []);
              const grand = total + (p.monthly_platform_fee ?? 0);
              return (
                <tr key={p.id} className="hover:bg-navy3/50">
                  <td className="td"><p className="text-cream">{p.title}</p><p className="text-xs text-muted2">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p></td>
                  <td className="td text-muted">{p.client_name ?? "—"}</td>
                  <td className="td font-mono">v{p.version}</td>
                  <td className="td"><span className={proposalStatusBadge(p.status)}>{PROPOSAL_STATUS_LABELS[p.status] ?? p.status}</span></td>
                  <td className="td text-right font-mono">{brl(grand)}</td>
                  <td className="td text-xs text-muted2">{lastRead[p.id] ? new Date(lastRead[p.id]).toLocaleString("pt-BR") : "—"}</td>
                  <td className="td text-right"><Link href={`/admin/propostas/${p.id}`} className="text-gold text-sm hover:underline">Abrir</Link></td>
                </tr>
              );
            })}
            {proposals.length === 0 && <tr><td className="td text-muted2" colSpan={7}>Nenhuma proposta{status ? " neste status" : ""}. Crie a primeira.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
