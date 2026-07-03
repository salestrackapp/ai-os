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
import type { ProposalItem } from "@/lib/types";

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
