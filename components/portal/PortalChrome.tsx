"use client";
/**
 * Casca do portal do cliente (Salestrack AI v2 · kit ai-operating-system).
 * AppShell v5 + sidebar de 5 áreas; páginas v5 renderizam claras, telas legadas no frame escuro.
 * White-label: o acento do tenant sobrescreve o violeta (--brand) no escopo do portal.
 */
import { usePathname } from "next/navigation";
import { AppShell, Sidebar, SalestrackLogo } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { PORTAL_AREAS, areaForPortalPath, isV5PortalPath } from "@/lib/portal/nav";
import { PortalLegacyFrame } from "./PortalLegacyFrame";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourLink } from "@/components/tour/TourLink";

// Alvos do tour nos itens de menu (por área).
const NAV_TOUR: Record<string, string> = { copilotos: "nav-copilotos", automacoes: "nav-automacoes", visao: "nav-visao" };

type Props = {
  email: string; displayName: string; logoUrl: string | null;
  accent: string; wl: boolean; wlStyle: string; adminView: boolean; orgName: string; tourSeen: boolean;
  adminExit?: React.ReactNode; children: React.ReactNode;
};

function Brand({ displayName, logoUrl }: { displayName: string; logoUrl: string | null; accent: string }) {
  // White-label: logo do tenant manda. Sem logo do tenant → logo oficial Salestrack AI (design system).
  return (
    <div data-tour="brand">
      {logoUrl
        ? <img src={logoUrl} alt={displayName} className="max-h-9 max-w-[170px] object-contain" />
        : <SalestrackLogo />}
      <p className="mt-1 font-jbmono text-[10px] uppercase tracking-[0.14em] text-[color:var(--fg-3)]">Powered by AI OS</p>
    </div>
  );
}

function UserMenu({ email, accent }: { email: string; accent: string }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-montserrat text-xs font-semibold uppercase text-white" style={{ background: accent }}>
          {email.slice(0, 1)}
        </span>
        <span className="min-w-0"><span className="block truncate font-montserrat text-[12px] font-medium text-[color:var(--fg-1)]">{email}</span><span className="block font-jbmono text-[10px] text-[color:var(--fg-3)]">Cliente</span></span>
      </div>
      <div className="mt-2 space-y-1">
        <TourLink entryPath="/portal" />
        <form action="/api/signout" method="post">
          <button className="ds-focus flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-hairline-strong px-3 py-2 font-montserrat text-[13px] font-medium text-[color:var(--fg-2)] transition-colors hover:bg-[var(--bg-2)]"><Icon name="logout" size={14} /> Sair</button>
        </form>
      </div>
    </div>
  );
}

export function PortalChrome({ email, displayName, logoUrl, accent, wl, wlStyle, adminView, orgName, tourSeen, adminExit, children }: Props) {
  const path = usePathname();
  const active = areaForPortalPath(path);
  const groups = [{
    items: PORTAL_AREAS.map((a) => ({ label: a.label, href: a.href, active: a.key === active, icon: <Icon name={a.icon} size={18} />, dataTour: NAV_TOUR[a.key] })),
  }];
  const sidebar = <Sidebar groups={groups} brand={<Brand displayName={displayName} logoUrl={logoUrl} accent={accent} />} footer={<UserMenu email={email} accent={accent} />} />;

  // White-label: sobrescreve o acento do DS (violeta) pelo do tenant, no escopo do portal.
  const wlVars = wl ? {
    ["--brand" as string]: accent, ["--brand-hover" as string]: accent, ["--brand-deep" as string]: accent, ["--brand-light" as string]: accent,
    ["--tile" as string]: `${accent}1f`, ["--nav-accent" as string]: accent,
    ["--grad-brand" as string]: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
    ["--shadow-brand" as string]: `0 14px 32px -10px ${accent}73`,
  } : undefined;

  return (
    <div style={wlVars}>
      <AppShell sidebar={sidebar}>
        {/* Tour do cliente só quando NÃO é visão admin (não incomoda o operador espiando). */}
        {!adminView && <TourProvider surface="portal" entryPath="/portal" autoStart={!tourSeen} />}
        {adminView && (
          <div className="ds flex items-center justify-center gap-3 border-b border-hairline bg-[var(--tile)] px-5 py-2.5 text-center">
            <span className="font-montserrat text-[13px] text-[color:var(--brand-deep)]">Visão admin — portal de <b>{orgName}</b>.</span>
            {adminExit}
          </div>
        )}
        {isV5PortalPath(path) ? children : <PortalLegacyFrame wl={wl} wlStyle={wlStyle}>{children}</PortalLegacyFrame>}
      </AppShell>
    </div>
  );
}
