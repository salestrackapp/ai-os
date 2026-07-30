"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

export async function salvarCampanha(dados: {
  id?: string; nome: string; canal: string; leadSourceId: string;
  inicio: string; fim: string; custoReais: string; metaLeads: string; status: string; observacao: string;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.nome.trim()) throw new Error("Dê um nome à campanha.");
  if (!dados.inicio) throw new Error("Informe a data de início.");
  if (dados.fim && dados.fim < dados.inicio) throw new Error("A data de fim não pode ser antes do início.");

  const linha = {
    nome: dados.nome.trim(),
    canal: dados.canal,
    lead_source_id: dados.leadSourceId || null,
    inicio: dados.inicio,
    fim: dados.fim || null,
    custo_centavos: Math.round(Number(dados.custoReais.replace(",", ".")) * 100) || 0,
    meta_leads: dados.metaLeads ? Number(dados.metaLeads) : null,
    status: dados.status,
    observacao: dados.observacao.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = dados.id
    ? await svc.from("campaigns").update(linha).eq("id", dados.id)
    : await svc.from("campaigns").insert({ ...linha, created_by: m.userId });
  if (error) throw new Error(error.message);

  await audit(dados.id ? "campanha.editada" : "campanha.criada", "campaigns", dados.id, { nome: linha.nome });
  revalidatePath("/admin/marketing");
}

/** Encerra em vez de apagar: campanha encerrada continua explicando os leads que gerou. */
export async function encerrarCampanha(id: string) {
  const { svc } = await exigirAdmin();
  const { error } = await svc.from("campaigns")
    .update({ status: "encerrada", fim: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit("campanha.encerrada", "campaigns", id);
  revalidatePath("/admin/marketing");
}
