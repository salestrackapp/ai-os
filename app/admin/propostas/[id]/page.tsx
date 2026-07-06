import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProposalBuilder } from "@/components/proposals/ProposalBuilder";
import { ProposalDocument } from "@/components/proposals/ProposalDocument";
import { ProposalActions } from "@/components/proposals/ProposalActions";
import { AiAssist } from "@/components/AiAssist";
import { subscriptionFromProposal } from "@/app/admin/monetizacao/actions";
import {
  PROPOSAL_STATUS_LABELS, proposalStatusBadge, brl, type Proposal, type CatalogItem, type ProposalItem, type TimelinePhase,
} from "@/lib/types";

import { generateAction } from "@/app/admin/entregaveis/actions";
import { Icon } from "@/components/ui/icons";
import { platformSubscriptionEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECTION_LABELS: Record<string, string> = {
  contexto: "Contexto", investimento: "Investimento", timeline: "Timeline", plataforma: "Plataforma", condicoes: "Condições",
};
const fmtSecs = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;

export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: prop } = await supabase.from("proposals").select("*").eq("id", id).single();
  if (!prop) notFound();
  const p = prop as Proposal;

  // rascunho → edição no builder
  if (p.status === "rascunho") {
    const [{ data: catalog }, { data: deals }, { data: orgs }] = await Promise.all([
      supabase.from("catalog_items").select("*").eq("active", true).is("deleted_at", null).order("name"),
      supabase.from("deals").select("id, title, org_id").order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name").eq("is_salestrack", false).order("name"),
    ]);
    const items = (p.items as ProposalItem[]) ?? [];
    const aiCtx = [
      `Proposta: ${p.title}`,
      p.client_name ? `Cliente: ${p.client_name}` : "",
      p.frentes?.length ? `Frentes: ${p.frentes.join(", ")}` : "",
      items.length ? `Itens:\n${items.map((it) => `- ${it.name} · ${it.qty}x ${brl(it.price)} (${it.brand})`).join("\n")}` : "",
      p.monthly_platform_fee ? `Mensalidade plataforma: ${brl(p.monthly_platform_fee)}` : "",
    ].filter(Boolean).join("\n");
    return (
      <div>
        <div className="flex items-center gap-3 mb-6"><Link href="/admin/propostas" className="text-muted2 hover:text-gold text-sm">← Propostas</Link></div>
        <h1 className="font-serif text-4xl font-semibold mb-6">{p.title} <span className="text-muted2 text-2xl">· rascunho v{p.version}</span></h1>
        <div className="mb-5">
          <AiAssist context={aiCtx} title="Copiloto da proposta" actions={[
            { label: "Rascunhar contexto/abertura", task: "Escreva a seção de CONTEXTO/abertura da proposta: 1–2 parágrafos executivos conectando as dores prováveis do cliente à solução. Sem exagero, tom André Kachan." },
            { label: "Rascunhar plano da plataforma", task: "Escreva a seção PLATAFORMA (markdown): como o programa opera sobre a plataforma de IA (Claude Team/Enterprise) e o que isso entrega, coerente com os itens. Objetivo." },
            { label: "Rascunhar nota de ROI", task: "Escreva uma nota de ROI honesta e convincente para esta proposta, conectando os itens ao retorno esperado. Sem inventar números." },
            { label: "Rascunhar condições", task: "Escreva a seção CONDIÇÕES comerciais (prazos, parcelas, validade, próximos passos) de forma clara, em markdown." },
          ]} />
        </div>
        <ProposalBuilder catalog={(catalog as CatalogItem[]) ?? []} deals={(deals as { id: string; title: string; org_id: string | null }[]) ?? []} orgs={(orgs as { id: string; name: string }[]) ?? []} proposal={p} />
      </div>
    );
  }

  // enviada/decidida → analytics + preview
  const [{ data: events }, { data: versions }] = await Promise.all([
    supabase.from("proposal_events").select("*").eq("proposal_id", id).order("created_at", { ascending: false }),
    p.deal_id ? supabase.from("proposals").select("id, version, status").eq("deal_id", p.deal_id).order("version") : Promise.resolve({ data: [p] }),
  ]);
  const secTotals: Record<string, number> = {};
  (events ?? []).forEach((e) => { if (e.kind === "section_read") { const s = String(e.payload?.section ?? ""); secTotals[s] = (secTotals[s] ?? 0) + (Number(e.payload?.seconds) || 0); } });
  const maxSec = Math.max(1, ...Object.values(secTotals));
  const decision = (events ?? []).find((e) => ["approved", "adjust_requested", "refused"].includes(e.kind));
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/p/${p.access_token ?? ""}`;
  const { data: org } = p.org_id ? await supabase.from("organizations").select("id, name").eq("id", p.org_id).single() : { data: null };

  const docData = {
    title: p.title, client_name: p.client_name, valid_until: p.valid_until, frentes: p.frentes,
    items: (p.items as ProposalItem[]) ?? [], timeline: (p.timeline as TimelinePhase[]) ?? [],
    platform_plan_md: p.platform_plan_md, monthly_platform_fee: p.monthly_platform_fee,
    installments: p.installments, roi_note: p.roi_note, conditions_md: p.conditions_md, version: p.version,
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6"><Link href="/admin/propostas" className="text-muted2 hover:text-gold text-sm">← Propostas</Link></div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><ProposalDocument p={docData} /></div>
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-xl font-semibold">Status</h3>
              <span className={proposalStatusBadge(p.status)}>{PROPOSAL_STATUS_LABELS[p.status]}</span>
            </div>
            <p className="text-xs text-muted2 mb-1">v{p.version}{p.sent_at ? ` · enviada ${new Date(p.sent_at).toLocaleDateString("pt-BR")}` : ""}</p>
            <p className="text-sm text-muted mb-3">Conta: {org ? <Link href={`/admin/crm/contas/${org.id}`} className="text-gold hover:underline">{org.name}</Link> : <span className="text-muted2">nenhuma</span>}{p.client_name ? ` · ${p.client_name}` : ""}</p>
            <ProposalActions id={id} status={p.status} link={link} />
            {p.org_id && (
              <form action={generateAction.bind(null, "proposta", id)} className="mt-3 pt-3 border-t border-line">
                <button className="btn-ghost w-full justify-center text-sm"><Icon name="fileText" size={14} /> Gerar no Estúdio de Entregáveis →</button>
                <p className="text-[11px] text-muted2 mt-1">Versão executiva (PDF) com colunas André Kachan × Salestrack e portão de aprovação.</p>
              </form>
            )}
            {p.status === "aprovada" && p.org_id && platformSubscriptionEnabled() && (
              <form action={subscriptionFromProposal.bind(null, id)} className="mt-3 pt-3 border-t border-line">
                <button className="btn-gold w-full justify-center text-sm"><Icon name="creditCard" size={14} /> Criar assinatura (Plataforma AI OS)</button>
                <p className="text-[11px] text-muted2 mt-1">Liga o que foi vendido à cobrança: plano Professional + mensalidade {p.monthly_platform_fee ? brl(p.monthly_platform_fee) : "da proposta"}.</p>
              </form>
            )}
          </div>

          {(versions ?? []).length > 1 && (
            <div className="card p-6">
              <h3 className="font-serif text-lg font-semibold mb-3">Versões</h3>
              <div className="space-y-1">
                {(versions ?? []).map((v: { id: string; version: number; status: string }) => (
                  <Link key={v.id} href={`/admin/propostas/${v.id}`} className={`flex justify-between text-sm px-2 py-1 rounded ${v.id === id ? "bg-navy3 text-gold" : "text-muted hover:text-cream"}`}>
                    <span>v{v.version}</span><span className="text-xs text-muted2">{PROPOSAL_STATUS_LABELS[v.status]}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="card p-6">
            <h3 className="font-serif text-lg font-semibold mb-3">Leitura por seção</h3>
            {Object.keys(secTotals).length === 0 ? <p className="text-sm text-muted2">Sem leitura registrada ainda.</p> : (
              <div className="space-y-2">
                {Object.entries(secTotals).sort((a, b) => b[1] - a[1]).map(([s, secs]) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-muted">{SECTION_LABELS[s] ?? s}</span>
                    <div className="flex-1 h-2 rounded-full bg-navy3 overflow-hidden"><div className="h-full bg-gold" style={{ width: `${(secs / maxSec) * 100}%` }} /></div>
                    <span className="w-16 text-right font-mono text-xs text-cream">{fmtSecs(secs)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {decision && (
            <div className="card p-6">
              <h3 className="font-serif text-lg font-semibold mb-2">Decisão</h3>
              <p className="text-sm text-cream">{decision.kind === "approved" ? "Aprovada" : decision.kind === "adjust_requested" ? "Ajuste solicitado" : "Recusada"}</p>
              {decision.payload?.name && <p className="text-xs text-muted2">{String(decision.payload.name)}{decision.payload?.role ? ` · ${decision.payload.role}` : ""}</p>}
              {decision.payload?.note && <p className="text-sm text-muted mt-2">“{String(decision.payload.note)}”</p>}
              {p.content_hash && <p className="text-[10px] text-muted2 mt-3 font-mono break-all">hash: {p.content_hash}</p>}
            </div>
          )}

          <div className="card p-6">
            <h3 className="font-serif text-lg font-semibold mb-3">Eventos</h3>
            <ul className="space-y-2">
              {(events ?? []).slice(0, 12).map((e) => (
                <li key={e.id} className="flex justify-between text-xs"><span className="text-muted">{e.kind}</span><span className="text-muted2">{new Date(e.created_at).toLocaleString("pt-BR")}</span></li>
              ))}
              {(events ?? []).length === 0 && <li className="text-sm text-muted2">Sem eventos.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
