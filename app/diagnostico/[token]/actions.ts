"use server";
import { revalidatePath } from "next/cache";
import { DIAGNOSTICO_CAMPOS, saveIntakeByToken } from "@/lib/diagnostico";

export type SalvarState = { at: number; ok: boolean; enviado: boolean };

/** Salva o formulário público de diagnóstico (rascunho ou envio). Token é o segredo.
 * Retorna estado (em vez de void) para o formulário dar feedback visível de sucesso —
 * sem isso o cliente não via confirmação e achava que o envio tinha falhado. */
export async function salvarDiagnosticoAction(token: string, _prev: SalvarState, formData: FormData): Promise<SalvarState> {
  const dados: Record<string, string> = {};
  for (const c of DIAGNOSTICO_CAMPOS) dados[c.id] = String(formData.get(c.id) ?? "").trim();
  const enviar = String(formData.get("acao") ?? "") === "enviar";
  const res = await saveIntakeByToken(token, dados, enviar);
  revalidatePath(`/diagnostico/${token}`);
  return { at: Date.now(), ok: res.ok, enviado: enviar && res.ok };
}
