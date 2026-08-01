"use server";
import { revalidatePath } from "next/cache";
import { criarTemplate, removerTemplate, criarRegra, removerRegra } from "@/lib/relacionamento/responder";
import { exigirAdmin } from "@/lib/auth";

export async function criarTemplateAction(formData: FormData) {
  await exigirAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  if (!nome || !corpo) return;
  await criarTemplate({ nome, assunto: String(formData.get("assunto") ?? "").trim() || null, corpo, atalho: String(formData.get("atalho") ?? "").trim() || null });
  revalidatePath("/admin/relacionamento/config");
}
export async function removerTemplateAction(id: string) {
  await exigirAdmin();
  await removerTemplate(id);
  revalidatePath("/admin/relacionamento/config");
}
export async function criarRegraAction(formData: FormData) {
  await exigirAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const match_valor = String(formData.get("match_valor") ?? "").trim();
  if (!nome || !match_valor) return;
  const match_campo = String(formData.get("match_campo") ?? "remetente") === "assunto" ? "assunto" : "remetente";
  await criarRegra({ nome, match_campo, match_valor, acao_rotulo: String(formData.get("acao_rotulo") ?? "").trim() || null, acao_assign_to: String(formData.get("acao_assign_to") ?? "").trim() || null });
  revalidatePath("/admin/relacionamento/config");
}
export async function removerRegraAction(id: string) {
  await exigirAdmin();
  await removerRegra(id);
  revalidatePath("/admin/relacionamento/config");
}
