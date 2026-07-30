"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/configuracoes", label: "Segurança" },
  { href: "/admin/configuracoes/equipe", label: "Equipe" },
  { href: "/admin/configuracoes/contratos", label: "Contratos" },
  { href: "/admin/configuracoes/notificacoes", label: "Notificações" },
  { href: "/admin/configuracoes/auditoria", label: "Auditoria" },
  { href: "/admin/configuracoes/sinais", label: "Sinais" },
];

export function ConfigNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 mb-6 border-b border-line">
      {TABS.map((t) => {
        const active = t.href === "/admin/configuracoes" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${active ? "border-gold text-gold" : "border-transparent text-muted hover:text-cream"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
