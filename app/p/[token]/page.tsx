import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyAdmin } from "@/lib/whatsapp";
import { ProposalDocument } from "@/components/proposals/ProposalDocument";
import { ReadTracker } from "@/components/proposals/ReadTracker";
import { DecisionBar } from "@/components/proposals/DecisionBar";
import { PROPOSAL_STATUS_LABELS, type ProposalItem, type TimelinePhase } from "@/lib/types";

export const dynamic = "force-dynamic";

function Indisponivel({ msg }: { msg: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-navy text-cream">
      <div className="card p-10 text-center max-w-md">
        <p className="text-[11px] uppercase tracking-[.28em] text-gold mb-3">AI Operation System</p>
        <h1 className="font-serif text-3xl font-semibold mb-2">Proposta indisponível</h1>
        <p className="text-sm text-muted">{msg}</p>
      </div>
    </main>
  );
}

export default async function PublicProposal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data: prop } = await sb.from("proposals").select("*").eq("access_token", token).single();
  if (!prop) return <Indisponivel msg="O link é inválido ou foi revogado." />;
  if (prop.valid_until && new Date(prop.valid_until + "T23:59:59") < new Date()) {
    return <Indisponivel msg="Esta proposta expirou. Fale com a Salestrack para uma versão atualizada." />;
  }

  // Primeira abertura: registra 'viewed', muda status e notifica (uma vez)
  const { data: seen } = await sb.from("proposal_events").select("id").eq("proposal_id", prop.id).eq("kind", "viewed").limit(1);
  if (!seen || seen.length === 0) {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    await sb.from("proposal_events").insert({ proposal_id: prop.id, kind: "viewed", ip });
    if (prop.status === "enviada") await sb.from("proposals").update({ status: "em_leitura" }).eq("id", prop.id);
    await notifyAdmin(`👀 ${prop.client_name ?? "O cliente"} abriu a proposta "${prop.title}".`);
  }

  const doc = {
    title: prop.title, client_name: prop.client_name, valid_until: prop.valid_until, frentes: prop.frentes,
    items: (prop.items as ProposalItem[]) ?? [], timeline: (prop.timeline as TimelinePhase[]) ?? [],
    platform_plan_md: prop.platform_plan_md, monthly_platform_fee: prop.monthly_platform_fee,
    installments: prop.installments, roi_note: prop.roi_note, conditions_md: prop.conditions_md, version: prop.version,
  };
  const open = ["enviada", "em_leitura"].includes(prop.status);

  return (
    <main className="min-h-screen bg-navy py-8 px-4 pb-28">
      {open && <ReadTracker token={token} />}
      <ProposalDocument p={doc} />

      {!open && (
        <div className="max-w-4xl mx-auto mt-6 card p-6 text-center">
          <p className="text-sm text-cream">
            Proposta <span className="text-gold">{PROPOSAL_STATUS_LABELS[prop.status]?.toLowerCase()}</span>
            {prop.decided_at ? ` em ${new Date(prop.decided_at).toLocaleDateString("pt-BR")}` : ""}
            {prop.decision_note ? ` — ${prop.decision_note}` : ""}.
          </p>
          <p className="text-xs text-muted2 mt-1">Uma nova decisão não é mais possível neste link.</p>
        </div>
      )}

      {open && <DecisionBar token={token} />}
    </main>
  );
}
