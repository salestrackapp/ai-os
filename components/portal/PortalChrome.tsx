"use client";
/**
 * Casca do portal do cliente (Salestrack AI v2 · kit ai-operating-system).
 * AppShell v5 + sidebar de 5 áreas; páginas v5 renderizam claras, telas legadas no frame escuro.
 * White-label: o acento do tenant sobrescreve o violeta (--brand) no escopo do portal.
 */
import { usePathname } from "next/navigation";
import { AppShell, Sidebar, SalestrackLogo } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { PORTAL_AREAS, areaForPortalPath } from "@/lib/portal/nav";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourLink } from "@/components/tour/TourLink";

// Alvos do tour nos itens de menu (3 destinos U4: Minha Jornada · Entregas · Conta).
const NAV_TOUR: Record<string, string> = { jornada: "nav-jornada", entregas: "nav-entregas", conta: "nav-conta" };

type Props = {
  email: string; displayName: string; logoUrl: string | null;
  accent: string; wl: boolean; wlStyle: string; adminView: boolean; orgName: string; tourSeen: boolean;
  adminExit?: React.ReactNode; children: React.ReactNode;
};

function Brand({ displayName, logoUrl }: { displayName: string; logoUrl: string | null; accent: string }) {
  // White-label: logo do tenant manda. Sem logo do tenant → a arte clara da Salestrack AI,
  // porque a barra superior é navy e a arte padrão (navy sobre claro) sumiria nela.
  return (
    <div data-tour="brand" className="flex shrink-0 items-center gap-2.5">
      {logoUrl
        ? <img src={logoUrl} alt={displayName} className="max-h-[26px] max-w-[150px] object-contain" />
        : <SalestrackLogo variant="light" width={80} />}
      <span className="hidden font-jbmono text-[11px] uppercase tracking-[0.14em] text-white/45 sm:block">Powered by AI OS</span>
    </div>
  );
}

function UserMenu({ email, accent }: { email: string; accent: string }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-montserrat text-xs font-semibold uppercase text-white" style={{ background: accent }}>
          {email.slice(0, 1)}
        </span>
        <span className="min-w-0"><span className="block truncate font-montserrat text-[13px] font-medium text-white/85">{email}</span><span className="block font-jbmono text-[11px] text-white/40">Cliente</span></span>
      </div>
      <form action="/api/signout" method="post" className="mt-2">
        <button className="ds-focus flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-2 font-montserrat text-[14px] font-medium text-white/75 transition-colors hover:bg-white/10"><Icon name="logout" size={14} /> Sair</button>
      </form>
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

  // O white-label vive AQUI e não mais no frame legado (removido): o `wl-theme` + o <style>
  // retematizam as classes legadas (text-gold, btn-gold, badge-gold…), que são cores fixas do
  // Tailwind e não leem CSS var. Sem isto, um cliente com marca própria veria o ciano padrão.
  return (
    <div style={wlVars} className={wl ? "wl-theme" : undefined}>
      {wl && <style dangerouslySetInnerHTML={{ __html: wlStyle }} />}
      <AppShell sidebar={sidebar}
        brand={<Brand displayName={displayName} logoUrl={logoUrl} accent={accent} />}
        topbarRight={<TourLink surface="portal" entryPath="/portal"
          className="ds-focus hidden items-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-1.5 font-montserrat text-[14px] font-medium text-white/75 transition-colors hover:bg-white/10 sm:flex" />}>
        {/* Provider sempre montado (o botão "Fazer o tour" precisa do ouvinte, inclusive na visão admin);
            auto-abre só para o cliente real — não incomoda o operador espiando. */}
        <TourProvider surface="portal" entryPath="/portal" autoStart={!adminView && !tourSeen} />
        {adminView && (
          <div className="ds flex items-center justify-center gap-3 border-b border-hairline bg-[var(--tile)] px-5 py-2.5 text-center">
            <span className="font-montserrat text-[14px] text-[color:var(--brand-deep)]">Visão admin — portal de <b>{orgName}</b>.</span>
            {adminExit}
          </div>
        )}
        {children}
      </AppShell>
    </div>
  );
}
