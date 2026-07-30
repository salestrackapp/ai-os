import { createClient } from "@/lib/supabase/server";
import { PageHeader, ContentArea } from "@/components/ds";
import { resolvePortalOrg } from "@/lib/portal";
import { anthropicConfigured } from "@/lib/agents/runner";
import { ConsultorChat } from "@/components/portal/ConsultorChat";
import { getOrgFeatures } from "@/lib/plans/features";
import { Upsell } from "@/components/portal/Upsell";

export const dynamic = "force-dynamic";

export default async function ConsultorPage() {
  const m = await resolvePortalOrg();
  const orgId = m!.orgId!;
  if (!m!.adminView && !(await getOrgFeatures(orgId)).consultor) return <Upsell feature="consultor" />;
  const supabase = await createClient();
  // Retoma a conversa de portal mais recente da org
  const { data: conv } = await supabase.from("conversations").select("id").eq("org_id", orgId).eq("canal", "portal").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let initial: { role: "user" | "assistant"; content: string }[] = [];
  if (conv) {
    const { data: msgs } = await supabase.from("messages").select("role, content").eq("conversation_id", conv.id).in("role", ["user", "assistant"]).order("created_at").limit(50);
    initial = ((msgs ?? []) as { role: "user" | "assistant"; content: string }[]);
  }

  return (
    <ContentArea>
      <div>
        <PageHeader eyebrow="Seu copiloto" title="Consultor do Programa" />
        <p className="text-sm text-muted mb-5 max-w-2xl">Tire dúvidas sobre seu programa, materiais, sessões e Receitas do Playbook. Ele conhece o contexto do seu programa — mas não acessa nenhum sistema seu.</p>
        {!anthropicConfigured() && (
          <div className="card p-3 mb-4 border-goldline bg-[rgba(0, 122, 148,.06)]"><p className="text-sm text-gold">O consultor está temporariamente indisponível. Você ainda pode navegar pelo Playbook e pela Biblioteca.</p></div>
        )}
        <ConsultorChat initialMessages={initial} initialConversationId={conv?.id ?? null} />
      </div>
    </ContentArea>
  );
}
