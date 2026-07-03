import { brl, BRAND_LABELS, proposalTotals, type ProposalItem, type TimelinePhase } from "@/lib/types";
import { deliverablesOf } from "@/lib/service-desc";

export type ProposalDoc = {
  title: string; client_name?: string | null; valid_until?: string | null;
  frentes?: string[] | null; items?: ProposalItem[] | null; timeline?: TimelinePhase[] | null;
  platform_plan_md?: string | null; monthly_platform_fee?: number | null;
  installments?: number | null; roi_note?: string | null; conditions_md?: string | null;
  version?: number;
};

function Section({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} data-section={id} className="px-8 md:px-14 py-10 border-t border-line">
      {eyebrow && <p className="text-[11px] uppercase tracking-[.24em] text-gold mb-1">{eyebrow}</p>}
      <h2 className="font-serif text-3xl font-semibold mb-6">{title}</h2>
      {children}
    </section>
  );
}

export function ProposalDocument({ p }: { p: ProposalDoc }) {
  const items = p.items ?? [];
  const { byBrand, total } = proposalTotals(items);
  const ak = byBrand["andre_kachan"] ?? 0, st = byBrand["salestrack"] ?? 0, aios = byBrand["ai_os"] ?? 0;
  const inst = p.installments && p.installments > 1 ? p.installments : 1;
  const parcela = inst > 1 ? total / inst : total;

  return (
    <article className="bg-navy text-cream mx-auto max-w-4xl border border-line rounded-2xl overflow-hidden">
      {/* Capa */}
      <header className="px-8 md:px-14 pt-16 pb-12">
        <p className="text-[11px] uppercase tracking-[.28em] text-gold mb-4">Proposta · André Kachan × Salestrack AI</p>
        <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-[1.05] mb-6">{p.title}</h1>
        {p.client_name && <p className="text-lg text-muted">Preparada para <span className="text-cream">{p.client_name}</span></p>}
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted2">
          {p.version && <span>Versão {p.version}</span>}
          {p.valid_until && <span>· Válida até {new Date(p.valid_until + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
        </div>
      </header>

      {/* Contexto / frentes */}
      <Section id="contexto" eyebrow="Contexto" title="Frentes do programa">
        <div className="flex flex-wrap gap-2 mb-4">
          {(p.frentes ?? []).length ? (p.frentes ?? []).map((f) => <span key={f} className="badge-gold">{f}</span>)
            : <span className="text-sm text-muted2">Frentes a definir</span>}
        </div>
        {p.roi_note && <p className="text-muted leading-relaxed max-w-2xl">{p.roi_note}</p>}
      </Section>

      {/* Investimento — colunas duplas AK × ST */}
      <Section id="investimento" eyebrow="Investimento" title="Composição do investimento">
        <div className="overflow-x-auto">
          <table className="w-full mb-6">
            <thead><tr>
              <th className="th">Item</th><th className="th">Marca</th><th className="th text-right">Qtd</th>
              <th className="th text-right">Unitário</th><th className="th text-right">Total</th>
            </tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="td text-cream">{it.name}</td>
                  <td className="td"><span className={it.brand === "andre_kachan" ? "badge-gold" : it.brand === "salestrack" ? "badge-teal" : "badge-muted"}>{BRAND_LABELS[it.brand] ?? it.brand}</span></td>
                  <td className="td text-right font-mono">{it.qty}</td>
                  <td className="td text-right font-mono">{brl(it.price)}</td>
                  <td className="td text-right font-mono">{brl((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td className="td text-muted2" colSpan={5}>Sem itens.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card p-5"><p className="label">Subtotal André Kachan</p><p className="font-serif text-2xl text-gold">{brl(ak)}</p><p className="text-xs text-muted2">Conhecimento</p></div>
          <div className="card p-5"><p className="label">Subtotal Salestrack AI</p><p className="font-serif text-2xl text-teal">{brl(st)}</p><p className="text-xs text-muted2">Execução técnica</p></div>
          <div className="card p-5 border-goldline"><p className="label">Investimento total</p><p className="font-serif text-2xl text-cream">{brl(total + aios)}</p>{inst > 1 && <p className="text-xs text-muted2">{inst}× de {brl(parcela)}</p>}</div>
        </div>

        {/* Escopo e entregas por item */}
        {items.some((it) => deliverablesOf(it.description).length > 0) && (
          <div className="mt-8">
            <p className="text-[11px] uppercase tracking-[.2em] text-gold mb-4">Escopo e entregas</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {items.map((it, i) => {
                const entregas = deliverablesOf(it.description);
                if (entregas.length === 0) return null;
                return (
                  <div key={i} className="card p-5">
                    <p className="font-serif text-lg font-semibold mb-1">{it.name}</p>
                    <p className="text-[11px] uppercase tracking-[.14em] text-muted2 mb-3">{BRAND_LABELS[it.brand] ?? it.brand}{it.qty > 1 ? ` · ${it.qty}×` : ""}</p>
                    <ul className="space-y-1.5">
                      {entregas.map((e, j) => (
                        <li key={j} className="flex gap-2 text-sm text-muted"><span className="text-gold shrink-0">✓</span><span>{e}</span></li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* Timeline horizontal */}
      {(p.timeline ?? []).length > 0 && (
        <Section id="timeline" eyebrow="Execução" title="Linha do tempo do programa">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(p.timeline ?? []).map((f) => (
              <div key={f.n} className="min-w-56 card p-5 relative">
                <div className="w-7 h-7 rounded-full bg-[rgba(200,155,60,.14)] border border-goldline text-gold flex items-center justify-center font-mono text-sm mb-3">{f.n}</div>
                <p className="font-serif text-lg font-semibold">{f.titulo}</p>
                <p className="text-[11px] uppercase tracking-[.14em] text-muted2 mb-2">{f.meses} {f.meses === 1 ? "mês" : "meses"}</p>
                <p className="text-sm text-muted leading-relaxed">{f.descricao}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Plano de plataforma + mensalidade AI OS */}
      <Section id="plataforma" eyebrow="Plataforma" title="Plataforma de IA do programa">
        <div className="card p-6 mb-4">
          <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{p.platform_plan_md || "O programa opera sobre uma plataforma de IA corporativa. Recomendação primária: Claude Team ou Enterprise."}</p>
        </div>
        <div className="card p-6 border-goldline bg-[rgba(200,155,60,.05)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[.2em] text-gold">Plataforma AI OS</p>
            <p className="text-sm text-muted">Forma e canal de entrega do programa · mensalidade recorrente</p>
          </div>
          <p className="font-serif text-3xl text-gold">{brl(p.monthly_platform_fee ?? 0)}<span className="text-sm text-muted2">/mês</span></p>
        </div>
      </Section>

      {/* Condições */}
      {p.conditions_md && (
        <Section id="condicoes" eyebrow="Condições" title="Condições comerciais">
          <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap max-w-3xl">{p.conditions_md}</p>
        </Section>
      )}

      <footer className="px-8 md:px-14 py-8 border-t border-line text-center">
        <p className="text-[11px] uppercase tracking-[.28em] text-gold">André Kachan · Salestrack AI</p>
      </footer>
    </article>
  );
}
