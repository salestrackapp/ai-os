"use server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { semearRegistro } from "@/lib/lgpd/registro";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return createServiceClient();
}

/**
 * Recarrega a semente versionada por cima do que está no banco.
 *
 * Não destrói: é upsert por chave. Serve para quando o código ganha uma operação nova — ligar uma
 * integração, criar uma finalidade — e o registro precisa acompanhar sem ninguém redigir à mão.
 */
export async function semearAction(): Promise<string> {
  await exigirAdmin();
  const r = await semearRegistro();
  await audit("lgpd.registro.semeado", "tratamento_operacoes", undefined, r);
  revalidatePath("/admin/lgpd/registro");
  revalidatePath("/privacidade");
  return `${r.operacoes} operações e ${r.operadores} operadores no registro.`;
}

const CAMPOS_OPERACAO = [
  "nome", "finalidade", "base_legal", "titulares", "dados", "origem",
  "compartilhamento", "retencao", "onde_no_sistema", "observacao",
] as const;

/**
 * Edita uma linha do registro.
 *
 * O que se edita aqui aparece IMEDIATAMENTE na política pública — é a mesma tabela. É por isso que
 * a lista de campos é fechada e a alteração é auditada: mudar uma frase aqui é mudar o que a
 * empresa declara publicamente sobre o que faz com dado pessoal.
 */
export async function editarOperacaoAction(chave: string, campos: Record<string, string>) {
  const svc = await exigirAdmin();
  const patch: Record<string, string> = {};
  for (const c of CAMPOS_OPERACAO) if (c in campos) patch[c] = campos[c].trim();
  if (!Object.keys(patch).length) throw new Error("Nada para alterar.");

  const { error } = await svc.from("tratamento_operacoes")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("chave", chave);
  if (error) throw new Error(error.message);

  await audit("lgpd.registro.editado", "tratamento_operacoes", undefined, { chave, campos: Object.keys(patch) });
  revalidatePath("/admin/lgpd/registro");
  revalidatePath("/privacidade");
}

/** Liga ou desliga um operador. Desligado, ele some da política pública no mesmo instante. */
export async function alternarOperadorAction(chave: string, ativo: boolean) {
  const svc = await exigirAdmin();
  const { error } = await svc.from("tratamento_operadores")
    .update({ ativo, updated_at: new Date().toISOString() }).eq("chave", chave);
  if (error) throw new Error(error.message);

  await audit("lgpd.registro.operador", "tratamento_operadores", undefined, { chave, ativo });
  revalidatePath("/admin/lgpd/registro");
  revalidatePath("/privacidade");
}
