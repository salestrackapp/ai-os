import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { apolloConfigured } from "@/lib/apollo";
import { scoreMinFor } from "@/lib/prospecting/score";
import { ICP_LABELS, PROSPECT_STATUS_LABELS, type Prospect, type ProspectAccount } from "@/lib/prospecting/types";
import { ConfigLink } from "@/components/config/ConfigLink";
import { PageHeader } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { HelpButton } from "@/components/guidance/HelpButton";
import { importPasted, addProspectManual, importFromApollo } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // permite imports em lote maiores sem estourar o tempo da função

const PAGE_SIZE = 50;

export default async function ProspeccaoPage({ searchParams }: { searchParams: Promise<{ icp?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  let q = supabase.from("prospects").select("*", { count: "exact" }).order("score", { ascending: false }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (sp.icp) q = q.eq("icp", sp.icp);
  if (sp.status) q = q.eq("status", sp.status);
  const [{ data: prospects, count: filteredCount }, { count: pendentes }, { count: total }] = await Promise.all([
    q,
    supabase.from("outreach_messages").select("id", { count: "exact", head: true }).eq("status", "rascunho"),
    supabase.from("prospects").select("id", { count: "exact", head: true }),
  ]);
  const list = (prospects as Prospect[]) ?? [];
  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (sp.icp) u.set("icp", sp.icp);
    if (sp.status) u.set("status", sp.status);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `/admin/prospeccao?${s}` : "/admin/prospeccao";
  };
  const accIds = [...new Set(list.map((p) => p.account_id).filter(Boolean))] as string[];
  const { data: accs } = accIds.length ? await supabase.from("prospect_accounts").select("id, name, domain, signals").in("id", accIds) : { data: [] as Pick<ProspectAccount, "id" | "name" | "domain" | "signals">[] };
  const accById: Record<string, { name: string; domain: string | null; signals: string[] | null }> = Object.fromEntries((accs ?? []).map((a) => [a.id, a]));
  const emCadencia = list.filter((p) => p.status === "em_cadencia").length;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Comercial", href: "/admin/comercial" }, { label: "Prospecção" }]} className="mb-4" />
      <PageHeader eyebrow="Comercial · pré-venda" title="Central de prospecção"
        subtitle="Prospecção por sinal e inteligência — nunca por volume. Dados internos da Salestrack."
        comoUsar={<HelpButton routeKey="/admin/prospeccao" />}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/prospeccao/aprovacao" className="btn-gold text-sm">Fila de aprovação {pendentes ? `(${pendentes})` : ""}</Link>
            <Link href="/admin/prospeccao/cadencias" className="btn-ghost text-sm">Cadências</Link>
            <ConfigLink cat="prospeccao" />
          </div>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="card p-6"><p className="label">Prospects</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{total ?? 0}</p></div>
        <div className="card p-6"><p className="label">Em cadência</p><p className="font-serif text-3xl font-semibold text-gold mt-1">{emCadencia}</p></div>
        <div className="card p-6"><p className="label">Rascunhos a aprovar</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{pendentes ?? 0}</p></div>
        <div className="card p-6"><p className="label">Reuniões</p><p className="font-serif text-3xl font-semibold text-cream mt-1">{list.filter((p) => p.status === "reuniao").length}</p></div>
      </div>

      {/* Importação */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="card p-6">
          <h2 className="font-serif text-lg font-semibold mb-3">Importar (colar CSV/TSV)</h2>
          <form action={importPasted} className="space-y-2">
            <p className="text-[11px] text-muted2">Cabeçalho flexível: <span className="font-mono">name, title, email, company, domain, icp, linkedin, seniority, industry, size, signals</span> (sinais separados por “;”).</p>
            <textarea name="data" rows={5} className="input w-full text-sm font-mono" placeholder={"name,title,email,company,icp,signals\nMaria Souza,CEO,maria@acme.com,Acme,icp1,rodada;contratacao"} required />
            <div className="flex items-center gap-2">
              <select name="icp" className="input text-sm"><option value="">ICP (default)</option>{Object.keys(ICP_LABELS).map((k) => <option key={k} value={k}>{ICP_LABELS[k]}</option>)}</select>
              <button className="btn-gold text-sm">Importar</button>
            </div>
          </form>
        </div>
        <div className="card p-6">
          <h2 className="font-serif text-lg font-semibold mb-3">Adicionar manual</h2>
          <form action={addProspectManual} className="grid grid-cols-2 gap-2">
            <input name="name" placeholder="Nome*" className="input text-sm" required />
            <input name="title" placeholder="Cargo" className="input text-sm" />
            <input name="email" placeholder="E-mail" className="input text-sm" />
            <input name="company" placeholder="Empresa" className="input text-sm" />
            <input name="linkedin" placeholder="LinkedIn URL" className="input text-sm" />
            <select name="icp" className="input text-sm"><option value="">ICP</option>{Object.keys(ICP_LABELS).map((k) => <option key={k} value={k}>{ICP_LABELS[k]}</option>)}</select>
            <input name="signals" placeholder="sinais (vírgula)" className="input text-sm col-span-2" />
            <button className="btn-gold text-sm col-span-2">Adicionar</button>
          </form>
          <form action={importFromApollo} className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-line">
            <select name="icp" className="input text-sm" defaultValue="icp1">{Object.keys(ICP_LABELS).map((k) => <option key={k} value={k}>{ICP_LABELS[k]}</option>)}</select>
            <select name="qtd" className="input text-sm" defaultValue="50">{[25, 50, 100].map((n) => <option key={n} value={n}>{n} prospects</option>)}</select>
            <button className="btn-ghost text-xs" disabled={!apolloConfigured()} title={apolloConfigured() ? "" : "Configure APOLLO_API_KEY"}>Buscar no Apollo</button>
            {!apolloConfigured() && <span className="text-[11px] text-muted2">Apollo em modo manual (sem chave)</span>}
          </form>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Link href="/admin/prospeccao" className={`badge-muted ${!sp.icp && !sp.status ? "!text-gold !border-goldline" : ""}`}>Todos</Link>
        {Object.keys(ICP_LABELS).map((k) => <Link key={k} href={`/admin/prospeccao?icp=${k}`} className={`badge-muted ${sp.icp === k ? "!text-gold !border-goldline" : ""}`}>{k.toUpperCase()}</Link>)}
        {Object.keys(PROSPECT_STATUS_LABELS).map((k) => <Link key={k} href={`/admin/prospeccao?status=${k}`} className={`badge-muted ${sp.status === k ? "!text-gold !border-goldline" : ""}`}>{PROSPECT_STATUS_LABELS[k]}</Link>)}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Prospect</th><th className="th">Empresa</th><th className="th">ICP</th><th className="th">Score</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {list.map((p) => {
              const min = scoreMinFor(p.icp);
              const apto = p.score >= min;
              const acc = p.account_id ? accById[p.account_id] : null;
              return (
                <tr key={p.id} className="hover:bg-navy3/50 border-b border-line last:border-0">
                  <td className="td text-cream">{p.name}<span className="block text-[11px] text-muted2">{p.title ?? ""}</span></td>
                  <td className="td text-muted">{acc?.name ?? "—"}{acc?.signals?.length ? <span className="block text-[10px] text-gold">⚡ {acc.signals.length} sinal(is)</span> : null}</td>
                  <td className="td text-xs text-muted2">{p.icp ? p.icp.toUpperCase() : "—"}</td>
                  <td className="td"><span className={apto ? "badge-teal" : "badge-muted"} title={`mínimo ICP: ${min}`}>{p.score}{apto ? "" : ` / ${min}`}</span></td>
                  <td className="td"><span className="badge-muted">{PROSPECT_STATUS_LABELS[p.status] ?? p.status}</span></td>
                  <td className="td text-right"><Link href={`/admin/prospeccao/${p.id}`} className="text-gold text-sm hover:underline">Abrir</Link></td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td className="td text-muted2" colSpan={6}>Nenhum prospect{sp.icp || sp.status ? " com este filtro" : ""}.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <span className="text-xs text-muted2">
          {filteredCount ? `${from + 1}–${Math.min(from + PAGE_SIZE, filteredCount)} de ${filteredCount}` : "0"} prospect(s){sp.icp || sp.status ? " (filtrado)" : ""} · página {page} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? <Link href={qs(1)} className="btn-ghost text-xs">« Primeira</Link> : <span className="btn-ghost text-xs opacity-30 pointer-events-none">« Primeira</span>}
          {page > 1 ? <Link href={qs(page - 1)} className="btn-ghost text-xs">← Anterior</Link> : <span className="btn-ghost text-xs opacity-30 pointer-events-none">← Anterior</span>}
          {page < totalPages ? <Link href={qs(page + 1)} className="btn-gold text-xs">Próxima →</Link> : <span className="btn-ghost text-xs opacity-30 pointer-events-none">Próxima →</span>}
          {page < totalPages ? <Link href={qs(totalPages)} className="btn-ghost text-xs">Última »</Link> : <span className="btn-ghost text-xs opacity-30 pointer-events-none">Última »</span>}
        </div>
      </div>
    </div>
  );
}
