import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalOrg } from "@/lib/portal";
import { getOrgFeatures } from "@/lib/plans/features";
import { exitPortalView } from "@/app/admin/programas/actions";
import { PortalChrome } from "@/components/portal/PortalChrome";
import { tourSeen } from "@/lib/tour/state";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const m = await resolvePortalOrg();
  if (!m) redirect("/login");
  if (m.isAdmin && !m.orgId) redirect("/admin/programas");
  if (!m.orgId) redirect("/sem-acesso");

  const supabase = await createClient();
  const [{ data: org }, { data: branding }, features, seen] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", m.orgId).single(),
    supabase.from("tenant_branding").select("*").eq("org_id", m.orgId).single(),
    getOrgFeatures(m.orgId),
    tourSeen("portal"),
  ]);
  // White-label N2/N3: acento do tenant só se o plano libera e o nível está setado; senão, violeta v5.
  const wl = !!features.whitelabel_n2 && ["n2_personalizado", "n3_whitelabel"].includes(branding?.level ?? "") && !!branding?.color_accent;
  const accent = wl ? branding!.color_accent : "#4F1FFF";
  const displayName = branding?.internal_name || org?.name || "Meu programa";
  // Override escopado (.wl-theme) para as telas LEGADAS (frame escuro) manterem o white-label.
  const wlStyle = wl ? `
    .wl-theme .text-gold{color:${accent}!important}
    .wl-theme .btn-gold{color:${accent}!important;border-color:${accent}!important;background:${accent}22!important}
    .wl-theme .border-goldline{border-color:${accent}!important}
    .wl-theme .badge-gold{color:${accent}!important;border-color:${accent}!important;background:${accent}22!important}
    .wl-theme .bg-gold{background:${accent}!important}
  ` : "";

  return (
    <PortalChrome
      email={m.email ?? ""} displayName={displayName} logoUrl={branding?.logo_url ?? null}
      accent={accent} wl={wl} wlStyle={wlStyle} adminView={!!m.adminView} orgName={org?.name ?? ""} tourSeen={seen}
      adminExit={m.adminView ? (
        <form action={exitPortalView}>
          <button className="ds-focus rounded-[8px] border border-hairline-strong bg-[var(--bg-1)] px-2.5 py-1 font-montserrat text-[12px] font-medium text-[color:var(--fg-2)] hover:bg-[var(--bg-2)]">Sair da visão</button>
        </form>
      ) : undefined}
    >
      {children}
    </PortalChrome>
  );
}
