/** Relacionamento · Relatórios (E5) — volume por canal/status, workload por membro, SLA e tempo de resposta. Read-only. */
import Link from "next/link";
import { ContentArea, PageHeader, Card, Kpi, Badge, EmptyState } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { STATUS_LABELS, type ConvStatus } from "@/lib/relacionamento/types";
import { buildRelatorio } from "@/lib/relacionamento/relatorios";

export const dynamic = "force-dynamic";

const STATUSES: ConvStatus[] = ["aberta", "aguardando", "respondida", "arquivada"];

export default async function Relatorios() {
  const r = await buildRelatorio();
  const pct = (n: number) => r.total ? Math.round((n / r.total) * 100) : 0;
  const bar = "h-2 rounded-full bg-[var(--brand)]";

  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin/hoje" }, { label: "Relacionamento", href: "/admin/relacionamento" }, { label: "Relatórios" }]} className="mb-4" />
      <PageHeader eyebrow="Relacionamento" title="Relatórios"
        subtitle="Volume por canal, tempo de resposta, SLA e carga por membro — a operação de e-mail e WhatsApp da equipe em números."
        actions={<Link href="/admin/relacionamento?canal=todos" className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input border border-hairline-strong bg-[var(--bg-1)] px-4 font-montserrat text-sm font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Abrir central</Link>} />

      {r.total === 0 ? (
        <Card><EmptyState icon={<Icon name="trending" size={22} />} title="Sem dados ainda" description="Assim que houver conversas de e-mail ou WhatsApp, os números aparecem aqui." /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi value={r.total} label="Conversas (total)" />
            <Kpi value={`${r.porCanal.email} · ${r.porCanal.whatsapp}`} label="E-mail · WhatsApp" />
            <Kpi value={r.atrasadas} label={`Atrasadas (SLA ${r.slaHoras}h)`} tone={r.atrasadas ? "down" : "neutral"} />
            <Kpi value={r.tempoRespostaMedioHoras != null ? `${r.tempoRespostaMedioHoras}h` : "—"} label={`1ª resposta (média · n=${r.amostraResposta})`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* volume por canal */}
            <Card>
              <p className="mb-3 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Volume por canal</p>
              {([["E-mail", r.porCanal.email], ["WhatsApp", r.porCanal.whatsapp]] as [string, number][]).map(([label, n]) => (
                <div key={label} className="mb-3">
                  <div className="mb-1 flex justify-between font-montserrat text-[12px] text-[color:var(--fg-2)]"><span>{label}</span><span>{n} · {pct(n)}%</span></div>
                  <div className="h-2 w-full rounded-full bg-[var(--bg-2)]"><div className={bar} style={{ width: `${pct(n)}%` }} /></div>
                </div>
              ))}
            </Card>

            {/* por status */}
            <Card>
              <p className="mb-3 font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">Por status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <div key={s} className="rounded-ds-card border border-hairline px-3 py-2">
                    <p className="font-montserrat text-[18px] font-semibold text-[color:var(--fg-1)]">{r.porStatus[s] ?? 0}</p>
                    <p className="font-montserrat text-[11px] text-[color:var(--fg-3)]">{STATUS_LABELS[s]}</p>
                  </div>
                ))}
                <div className="rounded-ds-card border border-hairline px-3 py-2">
                  <p className="font-montserrat text-[18px] font-semibold text-[color:var(--brand-deep)]">{r.naoLidas}</p>
                  <p className="font-montserrat text-[11px] text-[color:var(--fg-3)]">Não lidas</p>
                </div>
              </div>
            </Card>
          </div>

          {/* workload */}
          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-hairline px-4 py-2.5"><p className="ds-eyebrow !mb-0">Carga por membro (workload)</p></div>
            <ul className="divide-y divide-[color:var(--border)]">
              {r.workload.map((w) => (
                <li key={w.userId ?? "none"} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-montserrat text-[13px] text-[color:var(--fg-1)]">{w.email}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={w.abertas ? "warn" : "neutral"}>{w.abertas} aberta(s)</Badge>
                    <span className="font-jbmono text-[11px] text-[color:var(--fg-4)]">{w.total} no total</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="ds-small">Tempo de 1ª resposta é uma aproximação (primeira mensagem enviada após a primeira recebida em cada conversa). Read-only — a operação acontece na central.</p>
        </div>
      )}
    </ContentArea>
  );
}
