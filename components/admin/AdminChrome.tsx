"use client";
/**
 * Casca do admin — AppShell v6 (barra navy) + barra lateral das 4 áreas.
 * Não há mais dois frames: toda tela traz o próprio <ContentArea>.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, Sidebar, SalestrackLogo } from "@/components/ds";
import { Icon } from "@/components/ui/icons";
import { WORKSPACES, workspaceForPath } from "@/lib/admin/workspaces";
import { WorkspaceNav } from "./WorkspaceNav";
import { QuickSearch } from "./QuickSearch";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourLink } from "@/components/tour/TourLink";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// Alvos do tour nos itens de menu (por destino — 4 destinos U5).
const NAV_TOUR: Record<string, string> = { projetos: "nav-jornadas", crm: "nav-comercial", conteudo: "nav-estudio" };

/** Marca na barra superior navy — por isso a variante clara do logo. */
function Brand() {
  return (
    <Link href="/admin/central" data-tour="brand" className="ds-focus flex shrink-0 items-center gap-2.5">
      <SalestrackLogo variant="light" />
      <span className="hidden font-montserrat text-[14px] font-bold text-white sm:block">
        Salestrack OS <span className="text-[color:var(--brand-light)]">admin</span>
      </span>
    </Link>
  );
}

/** Rodapé da barra lateral navy: identidade de quem está logado e a saída. */
function UserMenu({ email }: { email: string }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-montserrat text-xs font-semibold uppercase text-[color:var(--brand-light)]">
          {email.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-montserrat text-[13px] font-medium text-white/85">{email}</span>
          <span className="block font-jbmono text-[11px] text-white/40">Salestrack</span>
        </span>
      </div>
      <form action="/api/signout" method="post" className="mt-2">
        <button className="ds-focus flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-2 font-montserrat text-[14px] font-medium text-white/75 transition-colors hover:bg-white/10">
          <Icon name="logout" size={14} /> Sair
        </button>
      </form>
    </div>
  );
}

export function AdminChrome({ email, userId, tourSeen, children }: { email: string; userId: string; tourSeen: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = workspaceForPath(path);
  const groups = [
    {title:"Trabalho",items:WORKSPACES.filter(w=>!["config","gestao"].includes(w.key)).map(w=>({label:w.label,href:w.href,active:active?.key===w.key,icon:<Icon name={w.icon} size={18}/>,dataTour:NAV_TOUR[w.key]}))},
    {title:"Organização",items:WORKSPACES.filter(w=>["gestao","config"].includes(w.key)).map(w=>({label:w.label,href:w.href,active:active?.key===w.key,icon:<Icon name={w.icon} size={18}/>}))},
    {items:[{label:"Todas as ferramentas",href:"/admin/ferramentas",active:path==="/admin/ferramentas",icon:<Icon name="layers" size={18}/>} ]},
  ];
  const sidebar = <Sidebar groups={groups} brand={<Brand />} footer={<UserMenu email={email} />} />;
  return (
    <AppShell sidebar={sidebar} brand={<Brand />}
      topbarRight={<>
        <QuickSearch />
        <NotificationBell userId={userId} />
        <TourLink surface="admin" entryPath="/admin/hoje"
          className="ds-focus hidden items-center gap-1.5 rounded-[10px] border border-white/15 px-3 py-1.5 font-montserrat text-[14px] font-medium text-white/75 transition-colors hover:bg-white/10 sm:flex" />
      </>}>
      <TourProvider surface="admin" entryPath="/admin/hoje" autoStart={!tourSeen} />
      <WorkspaceNav />
      {children}
    </AppShell>
  );
}
