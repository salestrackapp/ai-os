import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { usdBrlLive } from "@/lib/finops/cost";
import { getSetting } from "@/lib/settings/resolve";
import { postSlackMessage, slackConfigured } from "@/lib/slack";

/** Cria um alerta com dedup por (kind, org_id, dia). Critico + Slack configurado → também ao Slack. */
async function raise(kind: string, severity: string, orgId: string | null, message: string) {
  const sb = createServiceClient();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  let q = sb.from("alerts").select("id").eq("kind", kind).neq("status", "resolvido").gte("created_at", dayStart.toISOString());
  q = orgId ? q.eq("org_id", orgId) : q.is("org_id", null);
  const { data: dup } = await q.limit(1);
  if ((dup ?? []).length) return;
  await sb.from("alerts").insert({ kind, severity, org_id: orgId, message });
  if (severity === "critico" && slackConfigured() && process.env.SLACK_OPS_CHANNEL) {
    await postSlackMessage(process.env.SLACK_OPS_CHANNEL, `🚨 [AI OS] ${message}`);
  }
}

/** Varredura de alertas por thresholds. Idempotente no dia. */
export async function scanAlerts(): Promise<{ criados: number }> {
  const sb = createServiceClient();
  const rate = await usdBrlLive();
  const costPctLimit = (await getSetting<number>("alert_cost_pct")) ?? 0.5; // custo IA acima de X% da mensalidade → margem comprimida
  const today = new Date().toISOString().slice(0, 10);
  const before = (await sb.from("alerts").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString())).count ?? 0;

  const orgName: Record<string, string> = Object.fromEntries(((await sb.from("organizations").select("id, name")).data ?? []).map((o) => [o.id, o.name]));

  // fatura vencida
  const { data: overdue } = await sb.from("invoices").select("org_id, amount").in("status", ["vencida", "atrasada"]);
  for (const i of overdue ?? []) if (i.org_id) await raise("fatura_vencida", "aviso", i.org_id, `Fatura vencida — ${orgName[i.org_id] ?? "cliente"}`);

  // saúde de hoje: churn alto + custo alto
  const { data: health } = await sb.from("tenant_health").select("org_id, churn_risk, mrr, ai_cost_usd").eq("date", today);
  for (const h of health ?? []) {
    if (h.churn_risk === "alto") await raise("churn_alto", "critico", h.org_id, `Risco de churn ALTO — ${orgName[h.org_id] ?? "cliente"}`);
    const mrrUsd = rate ? Number(h.mrr) / rate : Number(h.mrr);
    if (mrrUsd > 0 && Number(h.ai_cost_usd) > costPctLimit * mrrUsd)
      await raise("custo_ia", "aviso", h.org_id, `Custo de IA acima de ${Math.round(costPctLimit * 100)}% da mensalidade — ${orgName[h.org_id] ?? "cliente"} (US$ ${Number(h.ai_cost_usd).toFixed(2)})`);
  }

  /**
   * Pedido de titular com prazo chegando.
   *
   * A LGPD dá 15 dias para responder (art. 19, II), e um pedido esquecido é a única falha aqui que
   * a própria empresa nunca sente: o titular some, o dado continua no banco, e o descumprimento só
   * aparece se ele reclamar na ANPD. Por isso o prazo vira alerta antes de vencer — mesmo defeito,
   * e mesma correção, da fatura vencida que ninguém via.
   *
   * Um alerta agregado por dia, e não um por pedido: com a dedução por (kind, dia), um alerta por
   * pedido criaria uma linha nova toda manhã para o mesmo pedido parado.
   */
  const agora = new Date();
  const em5dias = new Date(agora.getTime() + 5 * 86400000).toISOString();
  const { data: dsr } = await sb.from("dsr_requests")
    .select("email, prazo_em").in("status", ["recebido", "em_analise"]).lte("prazo_em", em5dias);

  const vencidos = (dsr ?? []).filter((p) => new Date(p.prazo_em as string) < agora);
  const vencendo = (dsr ?? []).length - vencidos.length;
  if (vencidos.length) {
    await raise("dsr_prazo_vencido", "critico", null,
      `${vencidos.length} pedido(s) de titular com prazo VENCIDO — ${vencidos.slice(0, 3).map((p) => p.email).join(", ")}`);
  }
  if (vencendo > 0) {
    await raise("dsr_prazo", "aviso", null, `${vencendo} pedido(s) de titular vencem em menos de 5 dias`);
  }

  const after = (await sb.from("alerts").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString())).count ?? 0;
  return { criados: after - before };
}
