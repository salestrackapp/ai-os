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
 * Abre o incidente.
 *
 * `detectado_em` fica com o `now()` do banco e NÃO é campo do formulário — de propósito. É desse
 * instante que corre o prazo do art. 48, e deixar alguém digitá-lo permitiria, na pior hora
 * possível, ajustar para trás a data que prova o cumprimento. Quando o incidente começou antes
 * (`ocorrido_em`) é outra informação, essa sim editável.
 */
export async function abrirIncidenteAction(dados: {
  titulo: string; descricao: string; severidade: string; dadosAfetados?: string;
}) {
  const { svc, m } = await exigirAdmin();
  if (!dados.titulo.trim()) throw new Error("Dê um título ao incidente.");
  if (!dados.descricao.trim()) throw new Error("Descreva o que aconteceu, mesmo que em uma linha.");

  const { data, error } = await svc.from("incidentes_seguranca").insert({
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim(),
    severidade: dados.severidade,
    dados_afetados: dados.dadosAfetados?.trim() || null,
    responsavel: m.userId,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await audit("seguranca.incidente.aberto", "incidentes_seguranca", data.id, { severidade: dados.severidade });
  revalidatePath("/admin/lgpd/incidentes");
  return data.id as string;
}

const CAMPOS = [
  "titulo", "descricao", "severidade", "status", "dados_afetados", "causa", "acoes",
  "justificativa_risco",
] as const;

export async function atualizarIncidenteAction(id: string, campos: Record<string, string>) {
  const { svc } = await exigirAdmin();
  const patch: Record<string, unknown> = {};
  for (const c of CAMPOS) if (c in campos) patch[c] = campos[c].trim() || null;
  if (!Object.keys(patch).length) throw new Error("Nada para alterar.");

  // Fechar o incidente carimba a data; reabrir limpa, para não sobrar um "encerrado em" mentindo.
  if (patch.status === "encerrado") patch.encerrado_em = new Date().toISOString();
  if (patch.status && patch.status !== "encerrado") patch.encerrado_em = null;
  if (patch.status === "contido") patch.contido_em = new Date().toISOString();

  const { error } = await svc.from("incidentes_seguranca")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);

  await audit("seguranca.incidente.atualizado", "incidentes_seguranca", id, { campos: Object.keys(patch) });
  revalidatePath("/admin/lgpd/incidentes");
}

/**
 * Registra a decisão sobre risco relevante.
 *
 * Exige justificativa nos DOIS sentidos. Decidir não comunicar é legítimo e comum — e é justamente
 * a decisão que será questionada depois, então é a que mais precisa de razão escrita no momento em
 * que foi tomada. Deixar o "não" passar sem justificativa seria facilitar exatamente o caminho que
 * dá problema.
 */
export async function decidirRiscoAction(id: string, relevante: boolean, justificativa: string) {
  const { svc } = await exigirAdmin();
  if (justificativa.trim().length < 20) {
    throw new Error("Escreva a razão da decisão — ela é o que sustenta a escolha se alguém perguntar depois.");
  }
  const { error } = await svc.from("incidentes_seguranca").update({
    risco_relevante: relevante,
    justificativa_risco: justificativa.trim(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);

  await audit("seguranca.incidente.risco", "incidentes_seguranca", id, { relevante });
  revalidatePath("/admin/lgpd/incidentes");
}

/** Carimba a comunicação feita. São estas datas que provam o cumprimento do art. 48. */
export async function registrarComunicacaoAction(id: string, quem: "anpd" | "titulares") {
  const { svc } = await exigirAdmin();
  const campo = quem === "anpd" ? "anpd_notificada_em" : "titulares_notificados_em";
  const { error } = await svc.from("incidentes_seguranca")
    .update({ [campo]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);

  await audit("seguranca.incidente.comunicado", "incidentes_seguranca", id, { quem });
  revalidatePath("/admin/lgpd/incidentes");
}
