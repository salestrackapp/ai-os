"use server";
import { revalidatePath } from "next/cache";
import { DIAGNOSTICO_CAMPOS, saveIntakeByToken } from "@/lib/diagnostico";

/** Salva o formulário público de diagnóstico (rascunho ou envio). Token é o segredo. */
export async function salvarDiagnosticoAction(token: string, formData: FormData) {
  const dados: Record<string, string> = {};
  for (const c of DIAGNOSTICO_CAMPOS) dados[c.id] = String(formData.get(c.id) ?? "").trim();
  const enviar = String(formData.get("acao") ?? "") === "enviar";
  await saveIntakeByToken(token, dados, enviar);
  revalidatePath(`/diagnostico/${token}`);
}
