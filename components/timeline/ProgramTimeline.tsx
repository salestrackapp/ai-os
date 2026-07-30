import "server-only";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Badge, botaoClasses } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { AI_METHOD } from "@/lib/ds/method";
import { currentPhaseIndex, phaseStatusAt, cycleStepOf, type TimelinePhase } from "@/lib/timeline/position";
import { fMarkPhase } from "@/lib/crud/programa-actions";

/**
 * Linha do tempo do programa — narrativa (estrutura de proposta), estética Salestrack AI v2.
 * Um componente, dois modos: leitura (portal/Jornada) e condução (admin/ficha 360). Consome R2.2.
 */
export async function ProgramTimeline({ projectId, mode }: { projectId: string; mode: "leitura" | "conducao" }) {
  const sb = await createClient();
  const { data: p } = await sb.from("projects").select("id, timeline, cycle_step, progress_pct, status").eq("id", projectId).maybeSingle();
  const phases: TimelinePhase[] = Array.isArray(p?.timeline) ? (p!.timeline as TimelinePhase[]) : [];
  const { data: dels } = await sb.from("deliverables").select("id, title, frente, status").eq("project_id", projectId).is("deleted_at", null);

  if (!p || phases.length === 0) {
    return <EmptyState icon={<Icon name="rocket" size={22} />} title="A linha do tempo aparece aqui"
      description={mode === "conducao" ? "Adicione fases e marcos no editor do programa para montar a jornada." : "Assim que seu programa ganhar marcos, sua jornada se desenha aqui."}
      action={mode === "conducao" ? <Link href={`/admin/programas/${projectId}/editar`} className={botaoClasses()}><Icon name="pen" size={15} /> Editar programa</Link> : undefined} />;
  }

  const current = currentPhaseIndex(phases, p);
  const step = cycleStepOf(p);
  const next = phases[current + 1];
  const delFor = (titulo: string) => (dels ?? []).filter((d) => (d.frente ?? "").toLowerCase() === titulo.toLowerCase());
  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : null);

  return (
    <div className="ds">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ds-eyebrow">Linha do tempo</p>
          <p className="ds-small mt-1">Você está aqui: <b className="text-[color:var(--fg-1)]">{phases[current]?.titulo}</b> · passo <b className="text-[color:var(--fg-1)]">{AI_METHOD[step].title}</b> do método.{next ? ` Próximo marco: ${next.titulo}${next.planned_for ? ` (${fmt(next.planned_for)})` : ""}.` : " Você está no marco final."}</p>
        </div>
        {mode === "conducao" && <Link href={`/admin/programas/${projectId}/editar`} className="ds-focus inline-flex h-9 items-center gap-1.5 rounded-ds-input border border-hairline px-3 font-montserrat text-[14px] font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="pen" size={14} /> Editar no Programa</Link>}
      </div>

      <ol className="relative ml-1 border-l-2 border-[var(--border-strong)] pl-6">
        {phases.map((ph, i) => {
          const st = phaseStatusAt(phases, i, current);
          const linked = delFor(ph.titulo);
          const dotColor = st === "concluido" ? "var(--success)" : st === "atual" ? "var(--brand)" : "var(--gray-300)";
          return (
            <li key={i} className="relative mb-5 last:mb-0">
              {/* nó */}
              <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-[var(--bg-2)]" style={{ background: dotColor }}>
                {st === "concluido" && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
              </span>

              {st === "atual" ? (
                <div className="relative overflow-hidden rounded-ds-card p-5 text-white shadow-ds-brand" style={{ background: "var(--grad-brand)" }}>
                  <span aria-hidden className="absolute right-3 top-3 text-spark">✳</span>
                  <span className="inline-flex items-center gap-1.5 rounded-ds-pill bg-white/15 px-2.5 py-1 font-jbmono text-[11px] uppercase tracking-[0.12em]">você está aqui</span>
                  <p className="mt-2 font-montserrat text-lg font-bold tracking-[-0.02em]">{ph.titulo}</p>
                  <p className="mt-1 text-[14px] leading-snug text-white/85">{ph.descricao}</p>
                  <p className="mt-2 font-jbmono text-[13px] text-white/70">{ph.meses} {ph.meses === 1 ? "mês" : "meses"}{fmt(ph.planned_for) ? ` · previsto ${fmt(ph.planned_for)}` : ""}</p>
                  {linked.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{linked.map((d) => <Link key={d.id} href={mode === "conducao" ? "/admin/entregaveis" : "/portal/entregaveis"} className="inline-flex items-center gap-1 rounded-ds-pill bg-white/15 px-2.5 py-1 text-[13px] font-medium text-white hover:bg-white/25"><Icon name="fileText" size={11} /> {d.title}</Link>)}</div>}
                  {mode === "conducao" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={fMarkPhase.bind(null, projectId, i, "concluido")}><button className="ds-focus rounded-ds-input bg-spark px-3 py-1.5 font-montserrat text-[13px] font-semibold text-ink">Marcar concluído</button></form>
                      <Link href={`/admin/programas/${projectId}/editar`} className="ds-focus rounded-ds-input border border-white/40 px-3 py-1.5 font-montserrat text-[13px] font-medium text-white hover:bg-white/10">Editar marco</Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`rounded-ds-card border p-4 ${st === "concluido" ? "border-hairline bg-[var(--bg-1)]" : "border-dashed border-hairline bg-[var(--bg-1)]/60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-montserrat text-[14px] font-semibold ${st === "concluido" ? "text-[color:var(--fg-1)]" : "text-[color:var(--fg-3)]"}`}>{ph.titulo}</p>
                    <Badge tone={st === "concluido" ? "success" : "neutral"}>{st === "concluido" ? "concluído" : "previsto"}</Badge>
                  </div>
                  <p className="ds-small mt-1">{ph.descricao}</p>
                  <p className="mt-1.5 font-jbmono text-[13px] text-[color:var(--fg-4)]">{ph.meses} {ph.meses === 1 ? "mês" : "meses"}{st === "concluido" && fmt(ph.occurred_at) ? ` · concluído ${fmt(ph.occurred_at)}` : fmt(ph.planned_for) ? ` · previsto ${fmt(ph.planned_for)}` : ""}</p>
                  {linked.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{linked.map((d) => <Link key={d.id} href={mode === "conducao" ? "/admin/entregaveis" : "/portal/entregaveis"} className="inline-flex items-center gap-1 rounded-ds-pill border border-hairline bg-[var(--bg-2)] px-2 py-0.5 text-[13px] text-[color:var(--fg-2)] hover:border-[color:var(--brand-light)]"><Icon name="fileText" size={11} /> {d.title}</Link>)}</div>}
                  {mode === "conducao" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {st !== "concluido" && <form action={fMarkPhase.bind(null, projectId, i, "atual")}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Definir como atual</button></form>}
                      {st !== "concluido" && <form action={fMarkPhase.bind(null, projectId, i, "concluido")}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Concluir</button></form>}
                      {st === "concluido" && <form action={fMarkPhase.bind(null, projectId, i, "previsto")}><button className="ds-focus rounded-ds-input border border-hairline-strong px-2.5 py-1 font-montserrat text-[13px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Reabrir</button></form>}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {mode === "leitura" && (
        <Link href="/portal/consultor" className="mt-5 inline-flex items-center gap-1.5 font-montserrat text-[14px] font-medium text-[color:var(--brand)] hover:underline">
          <Icon name="sparkles" size={14} /> Dúvidas sobre a jornada? Fale com seu copiloto
        </Link>
      )}
    </div>
  );
}
