"use server";
import { abrirPedido } from "@/lib/lgpd/pedido-publico";

/**
 * Ação pública. Sem sessão, de propósito — quem exerce um direito não tem conta aqui, e exigir
 * cadastro para pedir a exclusão dos próprios dados seria pedir mais dados para apagar dados.
 *
 * A validação, o limite de taxa e a decisão de nunca revelar se o endereço existe na base moram em
 * `lib/lgpd/pedido-publico.ts`, para a regra ser testável sem subir Next.
 */
export async function abrirPedidoAction(dados: {
  tipo: string; email: string; nome?: string; detalhe?: string;
}): Promise<{ ok: boolean; mensagem: string }> {
  return abrirPedido(dados);
}
