import { NextResponse, type NextRequest } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const recalculados = await recalcularEngajamento();
  const recasadas = await recasarOrfas();
  return NextResponse.json({ ok: true, recalculados, recasadas });
}
