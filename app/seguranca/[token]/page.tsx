import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Página pública "Segurança do AI OS" — o documento que o comitê de risco do cliente lê.
 *  Fora do guard (como o portal público de proposta). Respeita o white-label do tenant. */
export default async function SegurancaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data: g } = await svc.from("governance_policies").select("org_id, security_summary_md, published, published_at").eq("public_token", token).maybeSingle();
  if (!g || !g.published) notFound();
  const [{ data: org }, { data: b }] = await Promise.all([
    svc.from("organizations").select("name").eq("id", g.org_id).single(),
    svc.from("tenant_branding").select("internal_name, logo_url, color_accent").eq("org_id", g.org_id).maybeSingle(),
  ]);
  const accent = b?.color_accent || "#007A94";
  const nome = b?.internal_name || org?.name || "Empresa";

  return (
    <div className="min-h-screen bg-navy text-cream">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="flex items-center gap-3 mb-8 border-b border-line pb-6">
          {b?.logo_url ? <img src={b.logo_url} alt={nome} className="max-h-12 max-w-[180px] object-contain" /> : <p className="font-serif text-2xl font-semibold" style={{ color: accent }}>{nome}</p>}
        </div>
        <p className="text-[13px] uppercase tracking-[.24em] mb-2" style={{ color: accent }}>Segurança & Governança de IA</p>
        <h1 className="font-serif text-4xl font-semibold mb-2">Como {nome} usa IA com responsabilidade</h1>
        <p className="text-sm text-muted2 mb-8">Atualizado em {g.published_at ? new Date(g.published_at).toLocaleDateString("pt-BR") : "—"}</p>
        <div className="prose-invert text-cream whitespace-pre-wrap leading-relaxed text-[15px]">{g.security_summary_md || "Resumo em preparação."}</div>
        <p className="mt-12 pt-6 border-t border-line text-xs text-muted2">Documento de governança mantido no AI OS · Salestrack.</p>
      </div>
    </div>
  );
}
