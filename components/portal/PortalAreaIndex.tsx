/**
 * Índice de área do portal (Salestrack AI v2) — a "porta" de cada área, lista as subseções
 * (telas re-hospedadas) como cards navegáveis + uma ação primária opcional.
 */
import Link from "next/link";
import { ContentArea, PageHeader, Card } from "@/components/ds";
import { Breadcrumbs } from "@/components/ds/nav";
import { Icon } from "@/components/ui/icons";
import { PORTAL_AREAS, type PortalAreaKey } from "@/lib/portal/nav";
import { HelpButton } from "@/components/guidance/HelpButton";
import { NextActions } from "@/components/guidance/NextActions";

export function PortalAreaIndex({ area }: { area: PortalAreaKey }) {
  const a = PORTAL_AREAS.find((x) => x.key === area)!;
  return (
    <ContentArea>
      <Breadcrumbs items={[{ label: "Portal", href: "/portal" }, { label: a.label }]} className="mb-4" />
      <PageHeader eyebrow={a.label} title={a.label} subtitle={a.tagline}
        comoUsar={<HelpButton routeKey={a.href} />}
        actions={a.primary && (
          <Link href={a.primary.href}
            className="ds-focus inline-flex h-10 items-center gap-2 rounded-ds-input bg-brand px-4 font-montserrat text-sm font-semibold text-white shadow-ds-brand transition-colors hover:bg-brand-hover">
            <Icon name="sparkles" size={15} /> {a.primary.label}
          </Link>
        )} />

      {a.sections.length === 0 ? (
        <Card><p className="ds-body">Esta área ainda não tem subseções.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {a.sections.map((s) => (
            <Link key={s.href} href={s.href} className="group block">
              <div className="h-full rounded-ds-card border border-hairline bg-[var(--bg-1)] p-5 shadow-ds-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[color:rgba(79,31,255,0.28)] group-hover:shadow-ds-md">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--tile)] text-[color:var(--brand)]"><Icon name={s.icon} size={20} /></span>
                <p className="font-montserrat text-[15px] font-semibold text-[color:var(--fg-1)]">{s.label}</p>
                <p className="ds-small mt-1">{s.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 font-montserrat text-[12px] font-medium text-[color:var(--brand)]">Abrir <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </ContentArea>
  );
}
