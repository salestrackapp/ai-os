import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { rollupAiCost } from "@/lib/finops/cost";
import { computeTenantHealth } from "@/lib/ops/health";
import { scanAlerts } from "@/lib/ops/alerts";
import { dispararFollowupsVencidos } from "@/lib/relacionamento/followups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Jobs de observabilidade: rollup de custo + saúde por tenant + varredura de alertas. Idempotente por dia. */
export async function GET(req: NextRequest) {
  return comRegistro("ops", req, async () => {
  const day = new Date().toISOString().slice(0, 10);
  const cost = await rollupAiCost(day);
  const health = await computeTenantHealth(day);
  const alerts = await scanAlerts();
  const followups = await dispararFollowupsVencidos();
  return { day, cost, health, alerts, followups };
  });
}
