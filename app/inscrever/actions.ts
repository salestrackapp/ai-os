"use server";
import { inscrever } from "@/lib/marketing/inscricao";

/**
 * Ação pública. Sem sessão, de propósito — é um formulário aberto.
 *
 * A validação, o limite de taxa e a decisão de responder sempre a mesma coisa (para o formulário
 * não virar verificador de quem assina) moram em `lib/marketing/inscricao.ts`. Aqui fica só a
 * casca, para a regra ser testável sem subir Next.
 */
export async function inscreverAction(dados: {
  email: string; nome?: string; empresa?: string; aceite: boolean;
}): Promise<{ ok: boolean; mensagem: string }> {
  return inscrever(dados);
}
