"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/portal", label: "Meu Programa" },
  { href: "/portal/biblioteca", label: "Biblioteca" },
  { href: "/portal/equipe", label: "Equipe" },
  { href: "/portal/financeiro", label: "Financeiro" },
];

export function PortalNav({ accent }: { accent: string }) {
  const path = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-1">
      {NAV.map((n) => {
        const active = n.href === "/portal" ? path === n.href : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href}
            className={`block rounded-lg px-4 py-2.5 text-sm transition-colors ${active ? "bg-navy3 text-cream" : "text-muted hover:text-cream hover:bg-navy3"}`}
            style={active ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
