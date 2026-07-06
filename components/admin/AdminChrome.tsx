"use client";
/**
 * Casca do admin (Salestrack AI v2) — AppShell v5 + sidebar das 6 áreas.
 * Páginas v5 (Hoje + índices) renderizam claras; telas legadas abrem no LegacyFrame escuro.
 */
import { usePathname } from "next/navigation";
import { AppShell, Sidebar, SalestrackLogo } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { AREAS, areaForPath, isV5Path } from "@/lib/admin/nav";
import { LegacyFrame } from "./LegacyFrame";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourLink } from "@/components/tour/TourLink";

// Alvos do tour nos itens de menu (por área).
const NAV_TOUR: Record<string, string> = { clientes: "nav-clientes", comercial: "nav-comercial", estudio: "nav-estudio" };

function Brand() {
  return <span data-tour="brand"><SalestrackLogo subtitle="AI OS · admin" /></span>;
}

function UserMenu({ email }: { email: string }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tile)] font-montserrat text-xs font-semibold uppercase text-[color:var(--brand-deep)]">
          {email.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-montserrat text-[12px] font-medium text-[color:var(--fg-1)]">{email}</span>
          <span className="block font-jbmono text-[10px] text-[color:var(--fg-3)]">Salestrack</span>
        </span>
      </div>
      <div className="mt-2 space-y-1">
        <TourLink entryPath="/admin/hoje" />
        <form action="/api/signout" method="post">
          <button className="ds-focus flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-hairline-strong px-3 py-2 font-montserrat text-[13px] font-medium text-[color:var(--fg-2)] transition-colors hover:bg-[var(--bg-2)]">
            <Icon name="logout" size={14} /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminChrome({ email, tourSeen, children }: { email: string; tourSeen: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = areaForPath(path);
  const groups = [{
    items: AREAS.map((a) => ({
      label: a.label, href: a.href, active: a.key === active,
      icon: <Icon name={a.icon} size={18} />, dataTour: NAV_TOUR[a.key],
    })),
  }];
  const sidebar = <Sidebar groups={groups} brand={<Brand />} footer={<UserMenu email={email} />} />;
  return (
    <AppShell sidebar={sidebar}>
      <TourProvider surface="admin" entryPath="/admin/hoje" autoStart={!tourSeen} />
      {isV5Path(path) ? children : <LegacyFrame>{children}</LegacyFrame>}
    </AppShell>
  );
}
