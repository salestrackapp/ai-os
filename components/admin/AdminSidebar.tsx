"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";

/**
 * Arquitetura de informação do admin — agrupada pela cadeia de valor:
 * vender → fechar/cobrar → entregar → produzir ativos → operar a plataforma.
 * (ui-ux-pro-max: recognition over recall, ≤7 itens por grupo, ícones SVG.)
 */
const GROUPS: { title: string | null; items: { href: string; label: string; icon: string }[] }[] = [
  {
    title: null,
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "Comercial",
    items: [
      { href: "/admin/crm", label: "CRM", icon: "crm" },
      { href: "/admin/prospeccao", label: "Prospecção", icon: "target" },
      { href: "/admin/propostas", label: "Propostas", icon: "pen" },
      { href: "/admin/tarefas", label: "Tarefas", icon: "tasks" },
    ],
  },
  {
    title: "Receita",
    items: [
      { href: "/admin/contratos", label: "Contratos", icon: "scroll" },
      { href: "/admin/financeiro", label: "Financeiro", icon: "wallet" },
      { href: "/admin/monetizacao", label: "Monetização", icon: "gem" },
    ],
  },
  {
    title: "Entrega",
    items: [
      { href: "/admin/programas", label: "Programas", icon: "rocket" },
      { href: "/admin/onboarding", label: "Onboarding", icon: "userPlus" },
      { href: "/admin/consultor", label: "Consultor", icon: "chat" },
      { href: "/admin/roi", label: "ROI / Sucesso", icon: "trending" },
    ],
  },
  {
    title: "Método & Produção",
    items: [
      { href: "/admin/estudio", label: "Estúdio do Método", icon: "book" },
      { href: "/admin/entregaveis", label: "Estúdio de Entregáveis", icon: "fileText" },
      { href: "/admin/biblioteca-templates", label: "Templates", icon: "layers" },
      { href: "/admin/catalogo", label: "Catálogo", icon: "package" },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { href: "/admin/operacoes", label: "Operações", icon: "activity" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
    ],
  },
];

function isActive(path: string, href: string): boolean {
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(href + "/") || path.startsWith(href + "?");
}

export function AdminSidebar({ email, signout }: { email: string; signout: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]); // fecha o drawer ao navegar

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navegação principal">
      {GROUPS.map((g, gi) => (
        <div key={gi}>
          {g.title ? <p className="nav-group">{g.title}</p> : <div className="pt-3" />}
          <div className="space-y-0.5">
            {g.items.map((n) => (
              <Link key={n.href} href={n.href}
                aria-current={isActive(path, n.href) ? "page" : undefined}
                className={`nav-item ${isActive(path, n.href) ? "nav-item-active" : ""}`}>
                <Icon name={n.icon} size={17} />
                <span className="truncate">{n.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="px-5 py-6 border-b border-line">
      <p className="text-[10px] uppercase tracking-[.28em] text-gold">Salestrack AI</p>
      <p className="font-serif text-2xl font-semibold leading-tight">AI OS</p>
      <p className="text-[10px] uppercase tracking-[.2em] text-muted2 mt-0.5">Operating System</p>
    </div>
  );

  const footer = (
    <div className="p-3 border-t border-line">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="w-8 h-8 shrink-0 rounded-full bg-[rgba(79, 31, 255,.16)] border border-goldline text-gold flex items-center justify-center text-xs font-semibold uppercase">
          {email.slice(0, 1)}
        </span>
        <span className="text-xs text-muted2 truncate min-w-0">{email}</span>
      </div>
      {signout}
    </div>
  );

  return (
    <>
      {/* Barra mobile */}
      <div className="lg:hidden sticky top-0 z-40 glass border-b border-line flex items-center justify-between px-4 h-14">
        <p className="font-serif text-lg font-semibold">AI OS <span className="text-gold">·</span> Admin</p>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="btn-ghost !px-2.5 !py-2">
          <Icon name="menu" size={20} />
        </button>
      </div>

      {/* Backdrop mobile */}
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/55" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy2 border-r border-line flex flex-col transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="lg:hidden absolute top-4 right-3">
          <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="btn-ghost !px-2 !py-1.5"><Icon name="close" size={16} /></button>
        </div>
        {brand}
        {nav}
        {footer}
      </aside>
    </>
  );
}
