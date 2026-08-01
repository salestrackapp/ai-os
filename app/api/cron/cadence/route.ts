import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { processDueEnrollments } from "@/lib/prospecting/cadence";

/**
 * Processa os passos de cadência vencidos. Chamado pelo Vercel Cron (Authorization: Bearer CRON_SECRET)
 * ou manualmente com ?key=CRON_SECRET. Sem CRON_SECRET definido, recusa (segurança).
 */
export async function GET(req: NextRequest) {
  return comRegistro("cadence", req, async () => {
  const r = await processDueEnrollments();
  return { ...r };
  });
}
