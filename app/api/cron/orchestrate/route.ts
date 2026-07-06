import { NextRequest, NextResponse } from "next/server";
import { runScheduler, runAutomatics } from "@/lib/comms/orchestrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduler da orquestração (R4.3): avalia programas ativos (tempo) + processa itens automáticos due.
 * Protegido por CRON_SECRET. Configure em vercel.json (schedule). Graceful: sem cron, roda sob demanda.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const evalRes = await runScheduler();
  const automatics = await runAutomatics();
  return NextResponse.json({ ok: true, ...evalRes, automatics });
}
