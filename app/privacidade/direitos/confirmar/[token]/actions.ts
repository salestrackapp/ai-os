"use server";
import { confirmarPedido, type ResultadoConfirmacao } from "@/lib/lgpd/pedido-publico";

/** O segundo clique. Ação pública, sem sessão — quem confirma é o titular, que não tem conta aqui. */
export async function confirmarPedidoAction(token: string): Promise<ResultadoConfirmacao> {
  return confirmarPedido(token);
}
