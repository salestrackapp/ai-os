import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { PortalNav } from "@/components/portal/PortalNav";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const m = await currentMembership();
  if (!m) redirect("/login");
  if (m.isSalestrackAdmin) redirect("/admin");
  if (!m.orgId) redirect("/sem-acesso");

  const supabase = await createClient();
  const [{ data: org }, { data: branding }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", m.orgId).single(),
    supabase.from("tenant_branding").select("*").eq("org_id", m.orgId).single(),
  ]);
  const accent = branding?.color_accent || "#C89B3C";
  const displayName = branding?.internal_name || org?.name || "Meu Programa";

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-line bg-navy2 flex flex-col">
        <div className="px-6 py-7 border-b border-line">
          {branding?.logo_url
            ? <img src={branding.logo_url} alt={displayName} className="max-h-10 max-w-[160px] object-contain" />
            : <p className="font-serif text-xl font-semibold leading-tight" style={{ color: accent }}>{displayName}</p>}
          <p className="text-[10px] uppercase tracking-[.24em] text-muted2 mt-2">Powered by AI OS</p>
        </div>
        <PortalNav accent={accent} />
        <div className="p-4 border-t border-line">
          <p className="text-xs text-muted2 truncate mb-2">{m.email}</p>
          <form action="/api/signout" method="post"><button className="btn-ghost w-full justify-center text-xs">Sair</button></form>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-10">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-muted2">{org?.name}</p>
          <span className="badge-muted">Cliente</span>
        </div>
        {children}
      </main>
    </div>
  );
}
