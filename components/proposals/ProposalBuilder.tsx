"use client";
import { useState, useMemo, useTransition } from "react";
import {
  BRAND_LABELS, KIND_LABELS, FRENTE_SUGGESTIONS, brl, proposalTotals,
  type CatalogItem, type Proposal, type ProposalItem, type TimelinePhase,
} from "@/lib/types";
import { ProposalDocument } from "./ProposalDocument";
import { createProposal, updateProposal, sendProposal } from "@/app/admin/propostas/actions";

const DEFAULT_CONDITIONS = "O programa opera sobre plataforma de IA corporativa contratada pelo cliente — recomendação primária: Claude Team ou Enterprise.";

type DealLite = { id: string; title: string; org_id?: string | null };
type OrgLite = { id: string; name: string };

export function ProposalBuilder({ catalog, deals, orgs, proposal, initialDealId }: {
  catalog: CatalogItem[]; deals: DealLite[]; orgs: OrgLite[]; proposal?: Proposal; initialDealId?: string;
}) {
  const [tab, setTab] = useState<"form" | "preview">("form");
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [dealId, setDealId] = useState(proposal?.deal_id ?? initialDealId ?? "");
  const [orgId, setOrgId] = useState(proposal?.org_id ?? deals.find((d) => d.id === (proposal?.deal_id ?? initialDealId))?.org_id ?? "");
  const [clientName, setClientName] = useState(proposal?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(proposal?.client_email ?? "");
  const [validUntil, setValidUntil] = useState(proposal?.valid_until ?? "");
  const [frentes, setFrentes] = useState<string[]>(proposal?.frentes ?? []);
  const [items, setItems] = useState<ProposalItem[]>(proposal?.items ?? []);
  const [timeline, setTimeline] = useState<TimelinePhase[]>(proposal?.timeline ?? []);
  const [platChoice, setPlatChoice] = useState<"claude" | "stack">("claude");
  const [platMd, setPlatMd] = useState(proposal?.platform_plan_md ?? "");
  const [monthly, setMonthly] = useState<string>(proposal?.monthly_platform_fee != null ? String(proposal.monthly_platform_fee) : "");
  const [installments, setInstallments] = useState<string>(proposal?.installments != null ? String(proposal.installments) : "1");
  const [roi, setRoi] = useState(proposal?.roi_note ?? "");
  const [conditions, setConditions] = useState(proposal?.conditions_md ?? DEFAULT_CONDITIONS);
  const [pickQ, setPickQ] = useState(""); const [pickBrand, setPickBrand] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const { byBrand, total } = proposalTotals(items);
  const hasReview = items.some((it) => it.catalog_item_id && catalog.find((c) => c.id === it.catalog_item_id)?.needs_review);
  const num = (s: string) => Number(String(s).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

  const filteredCatalog = useMemo(() => catalog.filter((c) =>
    (!pickQ || c.name.toLowerCase().includes(pickQ.toLowerCase())) && (!pickBrand || c.brand === pickBrand)
  ), [catalog, pickQ, pickBrand]);

  function addItem(c: CatalogItem) {
    setItems((xs) => [...xs, { catalog_item_id: c.id, name: c.name, qty: 1, price: c.price ?? 0, brand: c.brand }]);
  }
  const setItem = (i: number, patch: Partial<ProposalItem>) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, ...patch } : x));
  const rmItem = (i: number) => setItems((xs) => xs.filter((_, j) => j !== i));

  const doc = {
    title: title || "Proposta sem título", client_name: clientName, valid_until: validUntil || null,
    frentes, items, timeline, platform_plan_md: platMd, monthly_platform_fee: num(monthly),
    installments: Number(installments) || 1, roi_note: roi, conditions_md: conditions, version: proposal?.version ?? 1,
  };

  function payload() {
    return {
      title, deal_id: dealId || null, org_id: orgId || null, client_name: clientName, client_email: clientEmail, valid_until: validUntil || null,
      frentes, items, timeline, platform_plan_md: platMd, monthly_platform_fee: num(monthly),
      installments: Number(installments) || 1, roi_note: roi, conditions_md: conditions,
    };
  }
  function save() {
    setMsg(null);
    start(async () => {
      if (proposal) { await updateProposal(proposal.id, payload()); setMsg("✓ Rascunho salvo."); }
      else { await createProposal(payload()); }
    });
  }
  function send() {
    if (!proposal) return;
    if (hasReview && !confirm("Há itens com preço a revisar (needs_review). Enviar mesmo assim?")) return;
    start(async () => { await sendProposal(proposal.id); setMsg("✓ Proposta enviada."); });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setTab("form")} className={`badge-muted ${tab === "form" ? "!text-gold !border-goldline" : ""}`}>Editar</button>
        <button onClick={() => setTab("preview")} className={`badge-muted ${tab === "preview" ? "!text-gold !border-goldline" : ""}`}>Preview</button>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-sm text-teal">{msg}</span>}
          {hasReview && <span className="text-xs text-amber-400">⚠ itens com preço a revisar</span>}
          <button className="btn-ghost" onClick={save} disabled={pending}>{proposal ? "Salvar rascunho" : "Criar rascunho"}</button>
          {proposal && <button className="btn-gold" onClick={send} disabled={pending}>Enviar proposta</button>}
        </div>
      </div>

      {tab === "preview" ? (
        <ProposalDocument p={doc} />
      ) : (
        <div className="grid xl:grid-cols-2 gap-5">
          {/* Coluna 1 */}
          <div className="space-y-5">
            <div className="card p-6 space-y-4">
              <h3 className="font-serif text-xl font-semibold">1 · Cabeçalho</h3>
              <div><label className="label">Título</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Programa de IA — Cliente" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Deal</label>
                  <select className="input" value={dealId} onChange={(e) => {
                    const v = e.target.value; setDealId(v);
                    const org = deals.find((d) => d.id === v)?.org_id;
                    if (org) setOrgId(org); // herda a conta do deal
                  }}>
                    <option value="">— nenhum —</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select></div>
                <div><label className="label">Conta</label>
                  <select className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                    <option value="">— nenhuma —</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select></div>
                <div><label className="label">Validade</label><input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
                <div><label className="label">Cliente</label><input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div><label className="label">E-mail do cliente</label><input className="input" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-serif text-xl font-semibold mb-3">2 · Frentes</h3>
              <div className="flex flex-wrap gap-1.5">
                {FRENTE_SUGGESTIONS.map((f) => (
                  <button key={f} onClick={() => setFrentes((xs) => xs.includes(f) ? xs.filter((y) => y !== f) : [...xs, f])}
                    className={`badge-muted ${frentes.includes(f) ? "!text-gold !border-goldline" : ""}`}>{f}</button>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-serif text-xl font-semibold mb-3">3 · Itens do catálogo</h3>
              <div className="flex gap-2 mb-3">
                <input className="input flex-1" value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Buscar item…" />
                <select className="input w-40" value={pickBrand} onChange={(e) => setPickBrand(e.target.value)}>
                  <option value="">Todas</option><option value="andre_kachan">André Kachan</option><option value="salestrack">Salestrack</option><option value="ai_os">AI OS</option>
                </select>
              </div>
              <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line mb-4">
                {filteredCatalog.slice(0, 40).map((c) => (
                  <button key={c.id} onClick={() => addItem(c)} className="w-full text-left px-3 py-2 hover:bg-navy3 flex items-center justify-between gap-2">
                    <span className="text-sm text-cream">{c.name} <span className="text-muted2 text-xs">· {KIND_LABELS[c.kind] ?? c.kind}</span>{c.needs_review && <span className="text-amber-400 text-xs"> ⚠ preço não confirmado</span>}</span>
                    <span className="font-mono text-xs text-muted">{brl(c.price)}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-cream truncate">{it.name}</span>
                    <span className={`${it.brand === "andre_kachan" ? "badge-gold" : it.brand === "salestrack" ? "badge-teal" : "badge-muted"} shrink-0`}>{BRAND_LABELS[it.brand]}</span>
                    <input className="input !py-1 w-14 font-mono" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
                    <input className="input !py-1 w-28 font-mono" value={it.price} onChange={(e) => setItem(i, { price: num(e.target.value) })} />
                    <button className="text-muted2 hover:text-red-400" onClick={() => rmItem(i)}>×</button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-sm text-muted2">Nenhum item — escolha acima.</p>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><p className="label">André Kachan</p><p className="font-mono text-gold">{brl(byBrand["andre_kachan"] ?? 0)}</p></div>
                <div><p className="label">Salestrack</p><p className="font-mono text-teal">{brl(byBrand["salestrack"] ?? 0)}</p></div>
                <div><p className="label">Total</p><p className="font-mono text-cream">{brl(total)}</p></div>
              </div>
            </div>
          </div>

          {/* Coluna 2 */}
          <div className="space-y-5">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-xl font-semibold">4 · Timeline</h3>
                <button className="btn-ghost text-xs" onClick={() => setTimeline((xs) => [...xs, { n: xs.length + 1, titulo: "", meses: 1, descricao: "" }])}>+ Fase</button>
              </div>
              <div className="space-y-3">
                {timeline.map((f, i) => (
                  <div key={i} className="border border-line rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <input className="input !py-1 flex-1" value={f.titulo} placeholder={`Fase ${f.n}`} onChange={(e) => setTimeline((xs) => xs.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} />
                      <input className="input !py-1 w-20 font-mono" value={f.meses} onChange={(e) => setTimeline((xs) => xs.map((x, j) => j === i ? { ...x, meses: Number(e.target.value) || 0 } : x))} />
                      <button className="text-muted2 hover:text-red-400" onClick={() => setTimeline((xs) => xs.filter((_, j) => j !== i).map((x, k) => ({ ...x, n: k + 1 })))}>×</button>
                    </div>
                    <input className="input !py-1" value={f.descricao} placeholder="Descrição" onChange={(e) => setTimeline((xs) => xs.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} />
                  </div>
                ))}
                {timeline.length === 0 && <p className="text-sm text-muted2">Sem fases.</p>}
              </div>
            </div>

            <div className="card p-6 space-y-3">
              <h3 className="font-serif text-xl font-semibold">5 · Plano de Plataforma</h3>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 text-muted"><input type="radio" name="plat" className="accent-[#C89B3C]" checked={platChoice === "claude"} onChange={() => setPlatChoice("claude")} /> Claude Team/Enterprise (recomendação primária)</label>
                <label className="flex items-center gap-2 text-muted"><input type="radio" name="plat" className="accent-[#C89B3C]" checked={platChoice === "stack"} onChange={() => setPlatChoice("stack")} /> Stack existente do cliente + trilha de migração</label>
              </div>
              <textarea className="input" rows={3} value={platMd} onChange={(e) => setPlatMd(e.target.value)} placeholder="Detalhe do plano de plataforma…" />
              <div><label className="label">Plataforma AI OS — mensalidade (R$/mês)</label><input className="input font-mono" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0,00" /></div>
            </div>

            <div className="card p-6 space-y-3">
              <h3 className="font-serif text-xl font-semibold">6 · Investimento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Parcelas (implantação)</label><input className="input font-mono" value={installments} onChange={(e) => setInstallments(e.target.value)} /></div>
                <div><label className="label">Valor da parcela</label><p className="input !bg-transparent font-mono">{brl((total) / (Number(installments) || 1))}</p></div>
              </div>
              <p className="text-xs text-muted2">Mensalidade Plataforma AI OS ({brl(num(monthly))}/mês) é cobrada à parte da implantação.</p>
              <div><label className="label">ROI / nota (opcional)</label><textarea className="input" rows={2} value={roi} onChange={(e) => setRoi(e.target.value)} /></div>
            </div>

            <div className="card p-6">
              <h3 className="font-serif text-xl font-semibold mb-3">7 · Condições</h3>
              <textarea className="input" rows={4} value={conditions} onChange={(e) => setConditions(e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
