"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/crm", label: "Pipeline" },
  { href: "/admin/crm/contas", label: "Contas" },
  { href: "/admin/crm/contatos", label: "Contatos" },
  { href: "/admin/crm/importar", label: "Importar" },
];

export function CrmNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 mb-6 border-b border-line">
      {TABS.map((t) => {
        const active = t.href === "/admin/crm" ? path === t.href : path.startsWith(t.href);
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
