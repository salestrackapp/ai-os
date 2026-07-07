import { NextResponse, type NextRequest } from "next/server";
import { rollupAiCost } from "@/lib/finops/cost";
import { computeTenantHealth } from "@/lib/ops/health";
import { scanAlerts } from "@/lib/ops/alerts";
import { dispararFollowupsVencidos } from "@/lib/relacionamento/followups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Jobs de observabilidade: rollup de custo + saúde por tenant + varredura de alertas. Idempotente por dia. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const day = new Date().toISOString().slice(0, 10);
  const cost = await rollupAiCost(day);
  const health = await computeTenantHealth(day);
  const alerts = await scanAlerts();
  const followups = await dispararFollowupsVencidos();
  return NextResponse.json({ ok: true, day, cost, health, alerts, followups });
}
