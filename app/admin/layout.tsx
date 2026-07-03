import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/tarefas", label: "Tarefas" },
  { href: "/admin/programas", label: "Programas" },
  { href: "/admin/propostas", label: "Propostas" },
  { href: "/admin/contratos", label: "Contratos" },
  { href: "/admin/financeiro", label: "Financeiro" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) redirect(m?.orgId ? "/portal" : "/sem-acesso");

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-line bg-navy2 flex flex-col">
        <div className="px-6 py-7 border-b border-line">
          <p className="text-[10px] uppercase tracking-[.28em] text-gold">Salestrack</p>
          <p className="font-serif text-2xl font-semibold leading-tight">AI OS <span className="text-gold">·</span> Admin</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="block rounded-lg px-4 py-2.5 text-sm text-muted hover:text-cream hover:bg-navy3 transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-line">
          <p className="text-xs text-muted2 truncate mb-2">{user.email}</p>
          <form action={signOut}><button className="btn-ghost w-full justify-center text-xs">Sair</button></form>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-10">{children}</main>
    </div>
  );
}
