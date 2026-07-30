"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { audit } from "@/lib/audit";
import { notifyAdmin } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";
import { contractHtml } from "@/lib/contract-html";
import { docusignConfigured, sendEnvelope } from "@/lib/docusign";
import { runKickoff } from "@/lib/kickoff";
import { currentMembership } from "@/lib/auth";
import { getContractSettings } from "@/lib/settings";
import { runCopilot } from "@/lib/agents/copilot";
import { brl, proposalTotals, type ProposalItem } from "@/lib/types";

/** Regenera a minuta usando IA a partir da proposta + cláusulas configuradas. Só em status 'minuta'. Rascunho para revisão jurídica. */
export async function regenerateContractByAi(contractId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).single();
  if (!c) throw new Error("Contrato não encontrado.");
  if (c.status !== "minuta") throw new Error("Só é possível regerar minutas (contrato ainda não enviado/assinado).");
  const [{ data: proposal }, { data: org }, cfg] = await Promise.all([
    c.proposal_id ? supabase.from("proposals").select("*").eq("id", c.proposal_id).single() : Promise.resolve({ data: null }),
    c.org_id ? supabase.from("organizations").select("name, cnpj").eq("id", c.org_id).single() : Promise.resolve({ data: null }),
    getContractSettings(),
  ]);
  const items = (proposal?.items as ProposalItem[]) ?? [];
  const totals = proposalTotals(items);
  const ctx = [
    `CONTRATADA: ${cfg.contratada_nome}, CNPJ ${cfg.contratada_cnpj}, ${cfg.contratada_endereco}.`,
    `CONTRATANTE: ${org?.name ?? proposal?.client_name ?? "Cliente"}${org?.cnpj ? `, CNPJ ${org.cnpj}` : ""}.`,
    `Objeto/frentes: ${(proposal?.frentes ?? []).join(", ") || "programa de IA"}.`,
    items.length ? `Itens:\n${items.map((it) => `- ${it.name} ${it.qty}x ${brl(it.price)}`).join("\n")}\nTotal: ${brl(totals.total)}` : "",
    proposal?.monthly_platform_fee ? `Mensalidade da plataforma: ${brl(proposal.monthly_platform_fee)}` : "",
    proposal?.installments ? `Parcelas de implantação: ${proposal.installments}x` : "",
    `Foro: ${cfg.foro}. Reajuste: ${cfg.reajuste_indice}. Aviso prévio: ${cfg.aviso_previo_dias} dias. Validade de créditos: ${cfg.creditos_validade_meses} meses.`,
    `CLÁUSULAS BASE (use e adapte):\n- Plataforma: ${cfg.clausula_plataforma}\n- Confidencialidade: ${cfg.clausula_confidencialidade}\n- LGPD: ${cfg.clausula_lgpd}\n- Rescisão: ${cfg.clausula_rescisao}`,
    cfg.clausulas_extras.length ? `Cláusulas extras:\n${cfg.clausulas_extras.map((e) => `- ${e.titulo}: ${e.corpo}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");

  const task = `Gere uma minuta de contrato de prestação de serviços COMPLETA e profissional, em HTML limpo e imprimível (fundo claro, tipografia sóbria, sem scripts). Estruture com cláusulas numeradas: qualificação das partes, objeto, escopo/entregas (baseado nas frentes e itens), valor e forma de pagamento, vigência e reajuste, obrigações das partes, confidencialidade, LGPD, rescisão, foro. Ao final, um bloco de assinaturas contendo EXATAMENTE o texto âncora "/assinatura_contratante/" na linha de assinatura do CONTRATANTE. Responda SOMENTE com o HTML do corpo do documento (sem cercas de código, sem comentários).`;
  const r = await runCopilot({ task, context: ctx, maxTokens: 3000 });
  if (r.degraded) throw new Error("IA indisponível (sem ANTHROPIC_API_KEY).");
  let html = r.text.trim().replace(/^```(?:html)?/i, "").replace(/```$/, "").trim();
  if (!/\/assinatura_contratante\//.test(html)) html += `\n<p style="margin-top:48px">_____________________________________<br/>/assinatura_contratante/<br/>${org?.name ?? proposal?.client_name ?? "CONTRATANTE"}</p>`;
  const { error } = await supabase.from("contracts").update({ content_html: html }).eq("id", contractId);
  if (error) throw new Error(error.message);
  await supabase.from("contract_events").insert({ contract_id: contractId, kind: "minuta_ia" });
  await audit("contract.ai_draft", "contracts", contractId, null, c.org_id ?? undefined);
  revalidatePath(`/admin/contratos/${contractId}`);
}

export async function generateContractFromProposal(proposalId: string) {
  const supabase = await createClient();
  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", proposalId).single();
  if (!proposal) throw new Error("Proposta não encontrada.");
  if (proposal.status !== "aprovada") throw new Error("Só é possível gerar contrato de proposta aprovada.");
  const { data: org } = proposal.org_id ? await supabase.from("organizations").select("id, name, cnpj").eq("id", proposal.org_id).single() : { data: null };

  const html = await contractHtml({
    title: proposal.title, org: { name: org?.name ?? proposal.client_name ?? "Cliente", cnpj: org?.cnpj },
    signerName: proposal.client_name, frentes: proposal.frentes, items: (proposal.items as ProposalItem[]) ?? [],
    installments: proposal.installments, monthlyFee: proposal.monthly_platform_fee, validUntil: proposal.valid_until,
  });

  const { data, error } = await supabase.from("contracts").insert({
    org_id: proposal.org_id, proposal_id: proposalId, status: "minuta", content_html: html,
    signer_name: proposal.client_name, signer_email: proposal.client_email,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("contract_events").insert({ contract_id: data.id, kind: "gerado" });
  await audit("contract.create", "contracts", data.id, { proposal_id: proposalId }, proposal.org_id ?? undefined);
  revalidatePath("/admin/contratos");
  redirect(`/admin/contratos/${data.id}`);
}

export async function sendForSignature(contractId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).single();
  if (!c) throw new Error("Contrato não encontrado.");
  if (c.status !== "minuta") throw new Error("Contrato já enviado ou assinado.");
  if (!docusignConfigured()) throw new Error("Docusign não configurado — use 'Registrar assinatura manual'.");
  if (!c.signer_email || !c.signer_name) throw new Error("Defina nome e e-mail do signatário.");

  const { envelopeId } = await sendEnvelope({ html: c.content_html, signerName: c.signer_name, signerEmail: c.signer_email, subject: `Contrato — ${c.signer_name}` });
  await supabase.from("contracts").update({ status: "enviado", docusign_envelope_id: envelopeId, sent_at: new Date().toISOString() }).eq("id", contractId);
  await supabase.from("contract_events").insert({ contract_id: contractId, kind: "enviado", payload: { envelopeId } });
  await audit("contract.sent", "contracts", contractId, { envelopeId }, c.org_id ?? undefined);
  await notifyAdmin(`📝 Contrato enviado para assinatura (Docusign): ${c.signer_name}.`);
  revalidatePath(`/admin/contratos/${contractId}`);
}

export async function registerManualSignature(contractId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).single();
  if (!c) throw new Error("Contrato não encontrado.");
  if (c.status === "assinado") throw new Error("Contrato já assinado.");
  const file = formData.get("file") as File | null;
  const signerName = String(formData.get("signer_name") ?? "").trim() || c.signer_name;
  const signerEmail = String(formData.get("signer_email") ?? "").trim() || c.signer_email;
  if (!file || file.size === 0) throw new Error("Envie o PDF assinado.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  const path = `${c.org_id ?? "sem-org"}/${contractId}.pdf`;
  const svc = createServiceClient();
  const up = await svc.storage.from("contratos").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);

  // status + hash no MESMO update (após 'assinado' a trigger trava a linha)
  const { error } = await supabase.from("contracts").update({
    status: "assinado", signed_at: new Date().toISOString(), signed_pdf_url: path,
    content_hash: hash, signer_name: signerName, signer_email: signerEmail, signed_manually: true,
  }).eq("id", contractId).neq("status", "assinado");
  if (error) throw new Error(error.message);
  await supabase.from("contract_events").insert({ contract_id: contractId, kind: "assinado", payload: { manual: true, hash } });
  await audit("contract.signed", "contracts", contractId, { manual: true, hash }, c.org_id ?? undefined);
  await notifyAdmin(`✅ Contrato assinado (manual): ${signerName}. Iniciando kickoff…`);
  if (signerEmail) {
    await sendEmail({ to: signerEmail, subject: "Contrato assinado — bem-vindo ao programa", title: "Contrato assinado ✓", bodyHtml: `<p>Olá, <b>${signerName ?? ""}</b>!</p><p>Seu contrato foi registrado com sucesso e o programa entrou em <b>onboarding</b>. Em breve entraremos em contato com os próximos passos do kickoff.</p>` });
  }

  await runKickoff(contractId);
  revalidatePath(`/admin/contratos/${contractId}`);
}

export async function reexecuteKickoff(contractId: string) {
  await runKickoff(contractId);
  revalidatePath(`/admin/contratos/${contractId}`);
}

/**
 * Gera a minuta A PARTIR DA BIBLIOTECA — determinística, sem IA.
 *
 * A geração por IA (`draftContractWithAI`) continua existindo para casos fora do padrão, mas não
 * deveria ser o caminho normal: ela reescreve o contrato a cada execução, e duas minutas do mesmo
 * serviço saem diferentes. Num documento que vai a assinatura, "parecido" não serve — o texto
 * precisa ser o mesmo que o jurídico revisou.
 *
 * Ao gerar, as cláusulas são CONGELADAS no contrato: a partir daí, editar a biblioteca não muda
 * este documento.
 */
export async function gerarMinutaDaBiblioteca(contractId: string, valores: Record<string, string>) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");

  const svc = createServiceClient();
  const { data: c } = await svc.from("contracts")
    .select("id, org_id, status, signer_name, organizations(name, cnpj)").eq("id", contractId).single();
  if (!c) throw new Error("Contrato não encontrado.");
  if (c.status === "assinado") throw new Error("Contrato assinado é imutável — gere um termo aditivo.");

  const { listarClausulas, montarMinuta, variaveisFaltantes, congelarNoContrato } =
    await import("@/lib/juridico/clausulas");
  const clausulas = (await listarClausulas()).filter((cl) => cl.vigente);
  if (clausulas.length === 0) throw new Error("A biblioteca de cláusulas está vazia.");

  const org = c.organizations as unknown as { name: string; cnpj: string | null } | null;
  const preenchidos: Record<string, string> = {
    cliente_nome: org?.name ?? c.signer_name ?? "",
    comarca: "São Paulo/SP",
    ...valores,
  };

  /**
   * Variável sem valor não passa. Um contrato que vai a assinatura com "no valor de ⟨valor_total⟩"
   * é pior que nenhum contrato — e o buraco costuma passar despercebido justamente porque o resto
   * do documento parece pronto.
   */
  const faltando = variaveisFaltantes(clausulas, preenchidos);
  if (faltando.length) {
    throw new Error(`Faltam preencher: ${faltando.join(", ")}. Sem isso a minuta sai com buracos.`);
  }

  const texto = montarMinuta(clausulas, preenchidos);
  const html = `<div style="font-family:Montserrat,Arial,sans-serif;font-size:14px;line-height:1.7;color:#1A1A2E">`
    + texto.split("\n\n").map((p) =>
        p.startsWith("CLÁUSULA")
          ? `<h2 style="margin:28px 0 10px;font-size:15px;font-weight:800">${p}</h2>`
          : `<p style="margin:0 0 12px;white-space:pre-wrap">${p}</p>`).join("")
    + `<p style="margin-top:48px">_____________________________________<br/>/assinatura_contratante/<br/>${org?.name ?? c.signer_name ?? "CONTRATANTE"}</p></div>`;

  const { error } = await svc.from("contracts").update({ content_html: html }).eq("id", contractId);
  if (error) throw new Error(error.message);

  const congeladas = await congelarNoContrato(contractId, preenchidos);
  await svc.from("contract_events").insert({
    contract_id: contractId, kind: "minuta_biblioteca",
    payload: { clausulas: congeladas || clausulas.length },
  });
  await audit("contract.minuta_biblioteca", "contracts", contractId,
    { clausulas: clausulas.length }, c.org_id ?? undefined);
  revalidatePath(`/admin/contratos/${contractId}`);
}
