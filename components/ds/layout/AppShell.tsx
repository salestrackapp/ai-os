/**
 * DS v5 · Primitivas de layout (Salestrack AI v2)
 * AppShell (sidebar fixa + conteúdo fluido; drawer no mobile) · Sidebar · NavBar (glass) ·
 * PageHeader (eyebrow + título sentence case + slots actions/configurar/comoUsar) ·
 * ContentArea · Section já vive em primitives.
 * Itens reais das 6 áreas chegam em R1.2 — aqui só a casca temável.
 */
"use client";
import { useState } from "react";
import { cn } from "@/lib/ds/cn";
import { Eyebrow } from "../primitives";

export type NavItem = { label: string; href: string; icon?: React.ReactNode; active?: boolean; dataTour?: string };
export type NavGroup = { title?: string; items: NavItem[] };

export function Sidebar({ groups, brand, footer }: { groups: NavGroup[]; brand?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-[var(--bg-1)]">
      {brand && <div className="px-5 py-5 border-b border-hairline">{brand}</div>}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Navegação">
        {groups.map((g, gi) => (
          <div key={gi} className="mb-1">
            {g.title && <p className="px-3 pb-1.5 pt-4 font-jbmono text-[10px] uppercase tracking-[0.14em] text-[color:var(--fg-4)]">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <a key={it.href} href={it.href} aria-current={it.active ? "page" : undefined} data-tour={it.dataTour}
                  className={cn("ds-focus flex items-center gap-3 rounded-[10px] px-3 py-2 font-montserrat text-[13px] transition-colors",
                    it.active ? "bg-[var(--tile)] font-semibold text-[color:var(--brand-deep)]" : "text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]")}>
                  {it.icon && <span className={it.active ? "text-[color:var(--brand)]" : "text-[color:var(--fg-3)]"}>{it.icon}</span>}
                  <span className="truncate">{it.label}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-hairline p-3">{footer}</div>}
    </div>
  );
}

export function AppShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds min-h-screen bg-[var(--bg-2)] lg:flex">
      {/* topbar mobile (glass) */}
      <div className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-hairline px-4"
        style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}>
        <span className="font-montserrat text-[15px] font-extrabold tracking-[-0.02em] text-[color:var(--fg-1)]">AI OS</span>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="ds-focus rounded-[10px] border border-hairline-strong px-2.5 py-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
        </button>
      </div>
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 border-r border-hairline transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        {sidebar}
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

/** NavBar sticky com glass leve (único lugar com glassmorphism). */
export function NavBar({ left, right, className }: { left?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ds sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline px-6", className)}
      style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

export function ContentArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[var(--container)] px-5 py-7 sm:px-8 lg:px-10", className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, actions, configurar, comoUsar, className }: {
  eyebrow?: string; title: string; subtitle?: string;
  actions?: React.ReactNode; configurar?: React.ReactNode; comoUsar?: React.ReactNode; className?: string;
}) {
  return (
    <header className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="ds-h1 mt-2">{title}</h1>
        {subtitle && <p className="ds-lead mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {(actions || configurar || comoUsar) && (
        <div className="flex items-center gap-2">{comoUsar}{configurar}{actions}</div>
      )}
    </header>
  );
}
