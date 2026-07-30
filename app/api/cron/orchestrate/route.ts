import { NextRequest, NextResponse } from "next/server";
import { runScheduler, runAutomatics } from "@/lib/comms/orchestrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduler da orquestração (R4.3): avalia programas ativos (tempo) + processa itens automáticos due.
 * Protegido por CRON_SECRET, no mesmo padrão fail-closed das demais rotas de cron.
 *
 * A guarda anterior era `if (secret && ...)`: sem CRON_SECRET definido a condição curto-circuitava
 * e a rota rodava SEM autenticação. Como ela dispara o agendador de comunicação e processa itens
 * automáticos, qualquer chamada externa acionava envios. Verificado aberto em produção em 2026-07-28.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const evalRes = await runScheduler();
  const automatics = await runAutomatics();
  return NextResponse.json({ ok: true, ...evalRes, automatics });
}
