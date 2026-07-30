import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmNav } from "@/components/crm/CrmNav";
import { DealDetail } from "@/components/crm/DealDetail";
import { AiAssist } from "@/components/AiAssist";
import { STAGE_LABELS, brl, type Deal, type SignalDefinition, type Contact, type Organization, type Task } from "@/lib/types";
import { ContentArea } from "@/components/ds";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).single();
  if (!deal) notFound();

  const [{ data: signalDefs }, { data: activities }, { data: contacts }, { data: orgs }, { data: tasks }, { data: proposals }] = await Promise.all([
    supabase.from("signal_definitions").select("*").eq("active", true).order("sort"),
    supabase.from("activities").select("id, kind, payload, created_at").eq("ref_table", "deals").eq("ref_id", id).order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").is("deleted_at", null).order("name"),
    supabase.from("organizations").select("*").eq("is_salestrack", false).order("name"),
    supabase.from("tasks").select("*").eq("deal_id", id).order("done").order("due_date", { nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("proposals").select("id, title, version, status").eq("deal_id", id).order("version", { ascending: false }),
  ]);

  const d = deal as Deal;
  // Contatos da conta (mesma org); se o deal não tem org, mostra leads sem org.
  const scoped = (contacts as Contact[] ?? []).filter((c) => d.org_id ? c.org_id === d.org_id : c.org_id === null);
  // garante que o contato principal apareça mesmo se estiver fora do escopo
  const primary = (contacts as Contact[] ?? []).find((c) => c.id === d.contact_id);
  const list = primary && !scoped.some((c) => c.id === primary.id) ? [primary, ...scoped] : scoped;

  const org = (orgs as Organization[] ?? []).find((o) => o.id === d.org_id);
  const recent = (activities as { kind: string; created_at: string }[] ?? []).slice(0, 8).map((a) => `- ${new Date(a.created_at).toLocaleDateString("pt-BR")}: ${a.kind}`).join("\n");
  const aiContext = [
    `Deal: ${d.title}`,
    `Estágio: ${STAGE_LABELS[d.stage] ?? d.stage} · valor ${brl(d.value_estimated)} · marca ${d.brand} · score ${d.score}`,
    d.next_step ? `Próximo passo atual: ${d.next_step}` : "",
    d.expected_close ? `Fechamento previsto: ${d.expected_close}` : "",
    d.last_activity_at ? `Última atividade: ${new Date(d.last_activity_at).toLocaleDateString("pt-BR")}` : "",
    Array.isArray(d.signals) && d.signals.length ? `Sinais: ${d.signals.join(", ")}` : "",
    org ? `Conta: ${org.name}` : "",
    primary ? `Contato: ${primary.name}${primary.role ? `, ${primary.role}` : ""}${primary.email ? ` <${primary.email}>` : ""}` : "",
    recent ? `Atividades recentes:\n${recent}` : "",
  ].filter(Boolean).join("\n");

  return (
    <ContentArea>
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/crm" className="text-muted2 hover:text-gold text-sm">← CRM</Link>
        </div>
        <CrmNav />
        <div className="mb-5">
          <AiAssist context={aiContext} title="Copiloto do deal" actions={[
            { label: "Analisar o deal", task: "Analise este deal: risco de perda, o que provavelmente está travando e a próxima melhor ação. Bullets curtos e acionáveis." },
            { label: "Rascunhar e-mail de follow-up", task: "Rascunhe um e-mail curto e profissional de follow-up para o contato deste deal, no tom da marca pessoal André Kachan, com um próximo passo claro. Pronto para enviar (com assunto)." },
            { label: "Rascunhar WhatsApp", task: "Rascunhe uma mensagem curta e cordial de WhatsApp para o contato, retomando a conversa com um convite objetivo." },
            { label: "Sugerir próximo passo", task: "Sugira o próximo passo concreto para avançar este deal no funil, em 1–2 frases." },
          ]} />
        </div>
        <DealDetail
          deal={d}
          signalDefs={(signalDefs as SignalDefinition[]) ?? []}
          activities={(activities as { id: string; kind: string; payload: Record<string, unknown> | null; created_at: string }[]) ?? []}
          contacts={list}
          orgs={(orgs as Organization[]) ?? []}
          tasks={(tasks as Task[]) ?? []}
          proposals={(proposals as { id: string; title: string; version: number; status: string }[]) ?? []}
        />
      </div>
    </ContentArea>
  );
}
