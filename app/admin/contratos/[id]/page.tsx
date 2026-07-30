import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { docusignConfigured } from "@/lib/docusign";
import { ContractActions } from "@/components/contracts/ContractActions";
import { AiAssist } from "@/components/AiAssist";
import { regenerateContractByAi } from "../actions";
import { CONTRACT_STATUS_LABELS, contractStatusBadge, type Contract } from "@/lib/types";
import { Icon } from "@/components/ui/icons";
import { ContentArea } from "@/components/ds";
import { MinutaDaBiblioteca } from "@/components/admin/MinutaDaBiblioteca";
import { listarClausulas } from "@/lib/juridico/clausulas";

export const dynamic = "force-dynamic";

type Step = { step: string; done: boolean; at: string | null; note?: string };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("contracts").select("*").eq("id", id).single();
  if (!c) notFound();
  const contract = c as Contract;

  const [{ data: events }, { data: project }, { data: org }] = await Promise.all([
    supabase.from("contract_events").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("projects").select("kickoff_checklist, status").eq("contract_id", id).limit(1).single(),
    contract.org_id ? supabase.from("organizations").select("id, name").eq("id", contract.org_id).single() : Promise.resolve({ data: null }),
  ]);
  const checklist = (project?.kickoff_checklist as Step[] | null) ?? [];

  // As variáveis que as cláusulas vigentes pedem. Vêm da biblioteca, não de uma lista fixa aqui —
  // acrescentar uma cláusula com variável nova passa a pedir o campo sozinho.
  const variaveisDaBiblioteca = [
    ...new Set((await listarClausulas()).filter((cl) => cl.vigente).flatMap((cl) => cl.variaveis)),
  ];

  let signedUrl: string | null = null;
  if (contract.signed_pdf_url) {
    const { data } = await createServiceClient().storage.from("contratos").createSignedUrl(contract.signed_pdf_url, 3600);
    signedUrl = data?.signedUrl ?? null;
  }

  return (
    <ContentArea>
      <div>
        <div className="flex items-center gap-3 mb-6"><Link href="/admin/contratos" className="text-muted2 hover:text-gold text-sm">← Contratos</Link></div>
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              <iframe title="Minuta" srcDoc={contract.content_html ?? "<p>Sem conteúdo</p>"} className="w-full" style={{ height: 720, border: 0, background: "#f4f1ea" }} />
            </div>
            <p className="text-[13px] text-muted2 mt-2">Template base — validar com assessoria jurídica antes do primeiro envio real.</p>
            {contract.status === "minuta" && (
              <>
                {/*
                  O caminho da biblioteca vem PRIMEIRO e como ação primária: é o texto que o
                  jurídico revisou, igual em todo contrato. A geração por IA fica abaixo, como
                  rascunho para casos fora do padrão — ela reescreve o contrato a cada execução, e
                  duas minutas do mesmo serviço saem diferentes.
                */}
                <MinutaDaBiblioteca contractId={id} variaveis={variaveisDaBiblioteca}
                  clienteNome={org?.name ?? contract.signer_name ?? ""} />
                <form action={regenerateContractByAi.bind(null, id)} className="mt-4 border-t border-hairline pt-3">
                  <button className="btn-ghost text-sm"><Icon name="sparkles" size={14} /> Regerar por IA (rascunho, fora do padrão)</button>
                  <p className="text-[13px] text-muted2 mt-1">Escreve uma minuta nova a partir da proposta. Sai diferente a cada execução — use só quando o caso não couber na biblioteca.</p>
                </form>
              </>
            )}
            <div className="mt-5">
              <AiAssist context={`Status: ${contract.status}\nCliente: ${org?.name ?? "—"}\n\nMINUTA:\n${(contract.content_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000)}`} title="Copiloto do contrato" actions={[
                { label: "Resumir a minuta", task: "Resuma esta minuta de contrato em bullets: partes, objeto, valores/prazos, renovação, rescisão e pontos de atenção." },
                { label: "Explicar em linguagem simples", task: "Explique as principais cláusulas em linguagem simples para um cliente leigo, sem jargão jurídico." },
                { label: "Pontos a revisar", task: "Aponte cláusulas ou lacunas que merecem revisão jurídica antes do envio. Seja específico." },
              ]} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-xl font-semibold">Status</h3>
                <span className={contractStatusBadge(contract.status)}>{CONTRACT_STATUS_LABELS[contract.status]}</span>
              </div>
              <p className="text-sm text-muted mb-1">{org ? <Link href={`/admin/crm/contas/${org.id}`} className="text-gold hover:underline">{org.name}</Link> : (contract.signer_name ?? "—")}</p>
              {contract.signed_at && <p className="text-xs text-muted2 mb-1">Assinado em {new Date(contract.signed_at).toLocaleString("pt-BR")}{contract.signed_manually ? " (manual)" : ""}</p>}
              {signedUrl && <a href={signedUrl} target="_blank" className="text-gold text-sm hover:underline">Ver PDF assinado ↗</a>}
              {contract.content_hash && <p className="text-[11px] text-muted2 mt-2 font-mono break-all">hash: {contract.content_hash}</p>}
              <div className="mt-4"><ContractActions id={id} status={contract.status} docusignOn={docusignConfigured()} signed={contract.status === "assinado"} /></div>
            </div>

            {checklist.length > 0 && (
              <div className="card p-6">
                <h3 className="font-serif text-lg font-semibold mb-3">Kickoff</h3>
                <ul className="space-y-2">
                  {checklist.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={s.done ? "text-teal" : "text-red-400"}>{s.done ? "✓" : "✗"}</span>
                      <div><span className="text-cream">{s.step}</span>{s.note && <span className="text-muted2 text-xs"> — {s.note}</span>}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card p-6">
              <h3 className="font-serif text-lg font-semibold mb-3">Eventos</h3>
              <ul className="space-y-2">
                {(events ?? []).map((e) => (
                  <li key={e.id} className="flex justify-between text-xs"><span className="text-muted">{e.kind}</span><span className="text-muted2">{new Date(e.created_at).toLocaleString("pt-BR")}</span></li>
                ))}
                {(events ?? []).length === 0 && <li className="text-sm text-muted2">Sem eventos.</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ContentArea>
  );
}
