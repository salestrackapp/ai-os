import { NextResponse, type NextRequest } from "next/server";
import { processDueEnrollments } from "@/lib/prospecting/cadence";

/**
 * Processa os passos de cadência vencidos. Chamado pelo Vercel Cron (Authorization: Bearer CRON_SECRET)
 * ou manualmente com ?key=CRON_SECRET. Sem CRON_SECRET definido, recusa (segurança).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await processDueEnrollments();
  return NextResponse.json({ ok: true, ...r });
}
