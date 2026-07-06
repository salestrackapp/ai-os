/** Editor v5 do Programa — metadados + estrutura (fases/marcos + passo do ciclo + entregáveis). */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { ContentArea, PageHeader, Card, Badge } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { MetaForm } from "@/components/admin/program-editor/MetaForm";
import { CycleMarker } from "@/components/admin/program-editor/CycleMarker";
import { fAddPhase, fUpdatePhase, fRemovePhase, fMovePhase, fAddDeliverable, fUpdateDeliverable, fRemoveDeliverable } from "@/lib/crud/programa-actions";
import { DELIVERABLE_STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";
type Phase = { n: number; titulo: string; meses: number; descricao: string };
const DEL_STATUS = Object.keys(DELIVERABLE_STATUS_LABELS);
const inputCls = "ds-focus w-full rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-3 py-2 font-montserrat text-sm text-[color:var(--fg-1)]";
const saveBtn = "ds-focus inline-flex h-9 items-center rounded-ds-input bg-brand px-3 font-montserrat text-[13px] font-semibold text-white hover:bg-brand-hover";
const ghostBtn = "ds-focus rounded-[8px] border border-hairline-strong px-2 py-1 font-montserrat text-[12px] text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]";

export default async function ProgramEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: org }, { data: dels }] = await Promise.all([
    p.org_id ? supabase.from("organizations").select("name").eq("id", p.org_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("deliverables").select("*").eq("project_id", id).is("deleted_at", null).order("created_at"),
  ]);
  const phases: Phase[] = Array.isArray(p.timeline) ? (p.timeline as Phase[]) : [];
  const deliverables = (dels as { id: string; title: string; frente: string | null; status: string }[]) ?? [];

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Programas", href: "/admin/programas" }, { label: "Editar" }]} className="mb-4" />
      <PageHeader eyebrow="Clientes" title={p.name} subtitle={`Cliente: ${org?.name ?? "—"}`}
        actions={<div className="flex items-center gap-2">
          <Link href={`/admin/programas/${id}`} className="ds-focus inline-flex h-10 items-center gap-1.5 rounded-ds-input border border-hairline px-3 font-montserrat text-[13px] font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]"><Icon name="rocket" size={15} /> Operação</Link>
        </div>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Passo do ciclo */}
          <Card>
            <p className="ds-eyebrow mb-1">Passo do ciclo (AI Operating Method)</p>
            <p className="ds-small mb-3">Marque onde o programa está — o cliente vê isto em destaque na Jornada.</p>
            <CycleMarker projectId={id} current={typeof p.cycle_step === "number" ? p.cycle_step : 0} />
          </Card>

          {/* Fases / marcos */}
          <Card>
            <p className="ds-eyebrow mb-3">Fases &amp; marcos</p>
            {phases.length === 0 ? <p className="ds-small mb-3">Nenhuma fase ainda. Adicione a primeira abaixo.</p> : (
              <ul className="mb-4 space-y-2">
                {phases.map((ph, i) => (
                  <li key={i} className="rounded-ds-card border border-hairline bg-[var(--bg-2)]">
                    <details>
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5">
                        <span className="min-w-0"><span className="font-montserrat text-[13px] font-semibold text-[color:var(--fg-1)]">{i + 1}. {ph.titulo}</span> <span className="ds-small">· {ph.meses} {ph.meses === 1 ? "mês" : "meses"}</span></span>
                        <span className="flex items-center gap-1">
                          <form action={fMovePhase.bind(null, id, i, -1)}><button className={ghostBtn} title="Subir">↑</button></form>
                          <form action={fMovePhase.bind(null, id, i, 1)}><button className={ghostBtn} title="Descer">↓</button></form>
                          <form action={fRemovePhase.bind(null, id, i)}><button className="ds-focus rounded-[8px] px-2 py-1 font-montserrat text-[12px] text-[color:var(--danger)] hover:bg-[var(--danger-tint)]" title="Remover">×</button></form>
                        </span>
                      </summary>
                      <form action={fUpdatePhase.bind(null, id, i)} className="space-y-2 border-t border-hairline px-4 py-3">
                        <input name="titulo" defaultValue={ph.titulo} className={inputCls} />
                        <input name="meses" type="number" min={0} defaultValue={ph.meses} className={inputCls} />
                        <textarea name="descricao" rows={2} defaultValue={ph.descricao} className={inputCls} />
                        <button className={saveBtn}>Salvar fase</button>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <form action={fAddPhase.bind(null, id)} className="space-y-2 rounded-ds-card border border-dashed border-hairline-strong p-3">
              <p className="ds-small !mt-0 font-semibold text-[color:var(--fg-2)]">Nova fase</p>
              <input name="titulo" placeholder="Título da fase" required className={inputCls} />
              <div className="flex gap-2">
                <input name="meses" type="number" min={0} defaultValue={1} placeholder="meses" className={inputCls} />
                <input name="descricao" placeholder="Descrição curta" className={inputCls} />
              </div>
              <button className={saveBtn}>Adicionar fase</button>
            </form>
          </Card>

          {/* Entregáveis */}
          <Card>
            <p className="ds-eyebrow mb-3">Entregáveis</p>
            {deliverables.length === 0 ? <p className="ds-small mb-3">Nenhum entregável. Adicione abaixo.</p> : (
              <ul className="mb-4 space-y-2">
                {deliverables.map((d) => (
                  <li key={d.id} className="rounded-ds-card border border-hairline bg-[var(--bg-2)]">
                    <details>
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5">
                        <span className="min-w-0"><span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{d.title}</span>{d.frente && <span className="ds-small"> · {d.frente}</span>}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone={d.status === "entregue" ? "success" : d.status === "bloqueado" ? "danger" : "neutral"}>{DELIVERABLE_STATUS_LABELS[d.status] ?? d.status}</Badge>
                          <form action={fRemoveDeliverable.bind(null, id, d.id)}><button className="ds-focus rounded-[8px] px-2 py-1 font-montserrat text-[12px] text-[color:var(--danger)] hover:bg-[var(--danger-tint)]" title="Remover">×</button></form>
                        </span>
                      </summary>
                      <form action={fUpdateDeliverable.bind(null, id, d.id)} className="space-y-2 border-t border-hairline px-4 py-3">
                        <input name="title" defaultValue={d.title} className={inputCls} />
                        <input name="frente" defaultValue={d.frente ?? ""} placeholder="Frente" className={inputCls} />
                        <select name="status" defaultValue={d.status} className={inputCls}>{DEL_STATUS.map((s) => <option key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</option>)}</select>
                        <button className={saveBtn}>Salvar entregável</button>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <form action={fAddDeliverable.bind(null, id, p.org_id)} className="space-y-2 rounded-ds-card border border-dashed border-hairline-strong p-3">
              <p className="ds-small !mt-0 font-semibold text-[color:var(--fg-2)]">Novo entregável</p>
              <input name="title" placeholder="Título do entregável" required className={inputCls} />
              <input name="frente" placeholder="Frente (opcional)" className={inputCls} />
              <button className={saveBtn}>Adicionar entregável</button>
            </form>
          </Card>
        </div>

        {/* Metadados */}
        <div>
          <Card>
            <p className="ds-eyebrow mb-3">Dados do programa</p>
            <MetaForm id={id} initial={p} />
          </Card>
        </div>
      </div>
    </ContentArea>
  );
}
