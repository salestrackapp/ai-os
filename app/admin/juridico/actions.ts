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

/**
 * Edita uma cláusula. A versão anterior é guardada pelo gatilho no banco — aqui só se exige o
 * MOTIVO, porque mudar cláusula sem dizer por quê deixa o histórico sem serventia: daqui a um ano
 * ninguém sabe se a redação mudou por decisão comercial, por exigência de cliente ou por erro.
 */
export async function salvarClausula(dados: {
  id: string; titulo: string; texto: string; motivo: string; vigente: boolean;
}) {
  const { svc } = await exigirAdmin();
  if (!dados.texto.trim()) throw new Error("A cláusula não pode ficar vazia.");
  if (!dados.motivo.trim()) throw new Error("Diga por que está mudando — é o que dá serventia ao histórico.");

  const { error } = await svc.from("clausulas").update({
    titulo: dados.titulo.trim(), texto: dados.texto.trim(),
    vigente: dados.vigente, observacao_interna: dados.motivo.trim(),
  }).eq("id", dados.id);
  if (error) throw new Error(error.message);

  await audit("juridico.clausula.editada", "clausulas", dados.id, { motivo: dados.motivo });
  revalidatePath("/admin/juridico");
}

export async function criarDemanda(dados: {
  tipo: string; titulo: string; descricao: string; prazo: string; prioridade: string; orgId: string;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.titulo.trim()) throw new Error("Dê um título à demanda.");
  const { error } = await svc.from("legal_matters").insert({
    tipo: dados.tipo, titulo: dados.titulo.trim(), descricao: dados.descricao.trim() || null,
    prazo: dados.prazo || null, prioridade: dados.prioridade,
    org_id: dados.orgId || null, responsavel: m.userId,
  });
  if (error) throw new Error(error.message);
  await audit("juridico.demanda.criada", "legal_matters", undefined, { tipo: dados.tipo, titulo: dados.titulo });
  revalidatePath("/admin/juridico");
}

export async function mudarStatusDemanda(id: string, status: string, resolucao?: string) {
  const { svc } = await exigirAdmin();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "concluida" || status === "arquivada") {
    patch.concluida_em = new Date().toISOString();
    if (resolucao?.trim()) patch.resolucao = resolucao.trim();
  } else patch.concluida_em = null;

  const { error } = await svc.from("legal_matters").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await audit("juridico.demanda.status", "legal_matters", id, { status });
  revalidatePath("/admin/juridico");
}
