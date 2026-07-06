import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { usdBrlLive } from "@/lib/finops/cost";

/**
 * Snapshot diário de saúde por tenant (só dados internos do AI OS).
 * churn_risk: engajamento baixo (<30) + (fatura vencida OU renovação <30d) → alto; engajamento <50 → medio; senão baixo.
 */
export async function computeTenantHealth(dayISO: string): Promise<{ orgs: number; alto: number }> {
  const sb = createServiceClient();
  const rate = await usdBrlLive();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const { data: orgs } = await sb.from("organizations").select("id, name").eq("is_salestrack", false);
  let alto = 0;
  for (const o of orgs ?? []) {
    const [{ count: logins }, { count: recipes }, { count: sessoes }, { count: convs }, { data: sub }, { data: overdue }, { data: cost }] = await Promise.all([
      sb.from("portal_access_log").select("id", { count: "exact", head: true }).eq("org_id", o.id).gte("created_at", since14),
      sb.from("recipe_progress").select("id", { count: "exact", head: true }).eq("org_id", o.id).eq("status", "concluida"),
      sb.from("sessions").select("id", { count: "exact", head: true }).eq("org_id", o.id).eq("status", "realizada"),
      sb.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", o.id).gte("created_at", since14),
      sb.from("subscriptions").select("monthly_platform_fee, status, current_period_end").eq("org_id", o.id).in("status", ["ativa", "trial"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("invoices").select("id").eq("org_id", o.id).in("status", ["vencida", "atrasada"]).limit(1),
      sb.from("ai_cost_daily").select("cost_usd").eq("org_id", o.id).gte("date", since30),
    ]);

    const engagement = Math.min(100, (logins ?? 0) * 5 + (recipes ?? 0) * 8 + (sessoes ?? 0) * 15 + (convs ?? 0) * 5);
    const mrr = Number(sub?.monthly_platform_fee ?? 0);
    const aiCost = (cost ?? []).reduce((a, c) => a + Number(c.cost_usd ?? 0), 0);
    const mrrUsd = rate ? mrr / rate : mrr;
    const margin = mrrUsd - aiCost;
    const temVencida = (overdue ?? []).length > 0;
    const renovaProx = sub?.current_period_end ? new Date(sub.current_period_end).getTime() - Date.now() < 30 * 86400000 : false;
    const churn = engagement < 30 && (temVencida || renovaProx) ? "alto" : engagement < 50 ? "medio" : "baixo";
    if (churn === "alto") alto++;

    await sb.from("tenant_health").upsert(
      { org_id: o.id, date: dayISO, engagement_score: engagement, mrr, ai_cost_usd: aiCost, margin_usd: margin, churn_risk: churn,
        signals: { logins: logins ?? 0, recipes: recipes ?? 0, sessoes: sessoes ?? 0, convs: convs ?? 0, tem_vencida: temVencida, renova_prox: renovaProx },
        computed_at: new Date().toISOString() },
      { onConflict: "org_id,date" },
    );
  }
  return { orgs: (orgs ?? []).length, alto };
}
