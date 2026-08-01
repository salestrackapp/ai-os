import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { recalcularEngajamento } from "@/lib/prospecting/engajamento";
import { recasarOrfas } from "@/lib/prospecting/linkedin";

/**
 * Recalcula o engajamento e recasa interações órfãs. Diário, pelo Vercel Cron.
 *
 * Duas coisas que só o tempo resolve:
 *  · o decaimento é contínuo, mas o número gravado em `prospects.engajamento` só muda quando
 *    chega um sinal novo. Sem este recálculo, quem parou de interagir em março continuaria no
 *    topo da fila em julho.
 *  · quem interagiu com um post ANTES de ser coletado pelo Apollo fica sem vínculo. É justamente
 *    a pessoa mais interessante — demonstrou interesse antes de sabermos que existia.
 */
export async function GET(req: NextRequest) {
  return comRegistro("engajamento", req, async () => {
  const recalculados = await recalcularEngajamento();
  const recasadas = await recasarOrfas();
  return { recalculados, recasadas };
  });
}
