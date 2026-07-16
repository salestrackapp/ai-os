"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { avancarJornada, setStageOwner, setNextAction } from "@/lib/journey";

function reval(orgId: string) {
  revalidatePath(`/admin/clientes/${orgId}`);
  revalidatePath("/admin/jornadas");
}

/** Conclui a etapa atual e ativa a próxima (a partir da ficha). */
export async function avancarFichaAction(projectId: string, orgId: string) {
  await avancarJornada(projectId);
  reval(orgId);
}

/** Assume/solta a etapa atual para o membro logado. */
export async function ownerFichaAction(projectId: string, etapa: number, orgId: string, assumir: boolean) {
  const m = await currentMembership();
  await setStageOwner(projectId, etapa, assumir ? (m?.userId ?? null) : null);
  reval(orgId);
}

/** Edita a próxima ação da etapa atual. */
export async function proximaAcaoFichaAction(projectId: string, etapa: number, orgId: string, formData: FormData) {
  const texto = String(formData.get("acao") ?? "").trim() || null;
  await setNextAction(projectId, etapa, texto);
  reval(orgId);
}
