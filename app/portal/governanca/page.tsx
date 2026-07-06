import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ds";
import { resolvePortalOrg } from "@/lib/portal";
import { anthropicConfigured } from "@/lib/agents/runner";
import { saveGovernance, draftGovernanceAI, publishGovernance } from "./actions";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function GovernancaPage() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  const canEdit = m!.isAdmin || m!.role === "client_admin";
  const supabase = await createClient();
  const { data: g } = await supabase.from("governance_policies").select("*").eq("org_id", orgId).maybeSingle();
  const publicUrl = g?.public_token ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/seguranca/${g.public_token}` : null;

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Governança" title="Política de Uso de IA" />
      <p className="text-sm text-muted mb-6">Documente a governança de IA da sua empresa. O <b>Resumo de Segurança</b> vira uma página pública que o comitê de risco dos seus clientes pode ler.</p>

      {!canEdit && <div className="card p-4 mb-4"><p className="text-sm text-muted2">Somente o administrador da conta pode editar a política.</p></div>}

      {canEdit && (
        <>
          <div className="flex items-center gap-2 mb-4">
            {anthropicConfigured() && <form action={draftGovernanceAI}><button className="btn-gold text-sm"><Icon name="sparkles" size={14} /> Rascunhar com IA (a partir do meu Stack)</button></form>}
            <a href="/portal/stack" className="btn-ghost text-sm">Meu Stack de IA →</a>
          </div>

          <form action={saveGovernance} className="space-y-4">
            <div><label className="label mb-1 block">Política completa (interna)</label><textarea name="policy_md" defaultValue={g?.policy_md ?? ""} rows={10} className="input w-full text-sm font-mono" placeholder="Política de uso de IA da empresa…" /></div>
            <div><label className="label mb-1 block">Resumo de Segurança (público)</label><textarea name="security_summary_md" defaultValue={g?.security_summary_md ?? ""} rows={6} className="input w-full text-sm" placeholder="Resumo que o comitê de risco do seu cliente vai ler…" /></div>
            <button className="btn-gold">Salvar</button>
          </form>

          <div className="card p-5 mt-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-cream">{g?.published ? "✅ Página de Segurança publicada" : "Página de Segurança não publicada"}</p>
                {g?.published && publicUrl && <a href={publicUrl} target="_blank" className="text-gold text-sm hover:underline break-all">{publicUrl}</a>}
              </div>
              <form action={publishGovernance.bind(null, !g?.published)}><button className="btn-ghost text-sm">{g?.published ? "Despublicar" : "Publicar"}</button></form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
