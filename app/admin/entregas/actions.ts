"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { registrarEntrega, mudarStatusEntrega } from "@/lib/entregas/escopo";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return { svc: createServiceClient(), m };
}

export async function criarEntrega(dados: {
  orgId: string; titulo: string; frente: string; prazo: string; observacao: string;
}) {
  const { svc } = await exigirAdmin();
  if (!dados.orgId) throw new Error("Escolha o cliente.");
  if (!dados.titulo.trim()) throw new Error("Diga o que será entregue.");

  /**
   * `deliverables.project_id` é obrigatório no schema, e o projeto é o que amarra a entrega ao
   * trabalho em curso. Sem projeto não há onde pendurar — e criar um projeto fantasma para
   * satisfazer a coluna seria esconder o problema em vez de dizê-lo.
   */
  const { data: proj } = await svc.from("projects")
    .select("id").eq("org_id", dados.orgId).order("created_at").limit(1).maybeSingle();
  if (!proj) throw new Error("Este cliente ainda não tem projeto. Crie o projeto antes de cadastrar entregas.");

  const { data: contrato } = await svc.from("contracts")
    .select("id").eq("org_id", dados.orgId).eq("status", "assinado").limit(1).maybeSingle();

  await registrarEntrega({
    orgId: dados.orgId, projectId: proj.id, contractId: contrato?.id ?? null,
    titulo: dados.titulo, frente: dados.frente.trim() || null,
    prazo: dados.prazo || null, observacao: dados.observacao.trim() || null,
  });
  revalidatePath("/admin/entregas");
}

export async function mudarStatus(id: string, status: string, motivo?: string) {
  const { m } = await exigirAdmin();
  await mudarStatusEntrega(id, status, motivo ?? null, m.userId);
  revalidatePath("/admin/entregas");
}

export async function removerEntrega(id: string) {
  const { svc } = await exigirAdmin();
  // Soft delete, como o resto da casa: o histórico do que foi prometido não some porque alguém
  // decidiu limpar a tela.
  await svc.from("deliverables").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/entregas");
}

/**
 * Coloca o projeto do cliente em stand-by. A data é a em que a obra REALMENTE parou, não a de
 * hoje: quem registra costuma fazê-lo dias depois, e usar a data do registro encurtaria o período
 * parado — justamente o número que sustenta a conversa sobre prazo.
 */
export async function pararProjetoDoCliente(dados: {
  orgId: string; motivo: string; desde: string; observacao: string;
}) {
  const { svc, m } = await exigirAdmin();
  const { data: proj } = await svc.from("projects")
    .select("id").eq("org_id", dados.orgId).order("created_at").limit(1).maybeSingle();
  if (!proj) throw new Error("Este cliente não tem projeto.");

  const { pararProjeto } = await import("@/lib/entregas/standby");
  await pararProjeto({
    projectId: proj.id, motivo: dados.motivo, desde: dados.desde,
    observacao: dados.observacao.trim() || null, autor: m.userId,
  });
  revalidatePath("/admin/entregas");
}

/** Retoma e empurra os prazos pendentes pelos dias parados. Devolve o que mudou, em português. */
export async function retomarProjetoDoCliente(projectId: string): Promise<string> {
  const { m } = await exigirAdmin();
  const { retomarProjeto } = await import("@/lib/entregas/standby");
  const r = await retomarProjeto(projectId, m.userId);
  revalidatePath("/admin/entregas");
  return r.dias === 0
    ? "Projeto retomado."
    : `Projeto retomado após ${r.dias} dia(s) parado(s). ${r.entregasAjustadas} prazo(s) empurrado(s) pelo mesmo período.`;
}
