import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { platformSubscriptionEnabled } from "@/lib/config";

export type PlanFeatures = {
  playbook: boolean; consultor: boolean; sessoes: boolean; roi: boolean;
  whitelabel_n2: boolean; whitelabel_n3: boolean; governanca_avancada: boolean;
  limite_membros: number; creditos_sessao_mes: number;
};

/** Default SEGURO (plano Base): nunca tranca o cliente para fora do portal essencial. */
export const BASE_FEATURES: PlanFeatures = {
  playbook: false, consultor: false, sessoes: false, roi: false,
  whitelabel_n2: false, whitelabel_n3: false, governanca_avancada: false,
  limite_membros: 5, creditos_sessao_mes: 0,
};

export const FEATURE_LABELS: Record<string, string> = {
  playbook: "Playbook", consultor: "Consultor", sessoes: "Sessões ao Vivo", roi: "ROI do Programa",
  whitelabel_n2: "White-label (tema próprio)", whitelabel_n3: "White-label (domínio próprio)",
  governanca_avancada: "Governança avançada", limite_membros: "Limite de membros", creditos_sessao_mes: "Créditos de sessão/mês",
};

/** plan_key da assinatura ATIVA da org; 'base' se não houver. */
export async function getOrgPlanKey(orgId: string): Promise<string> {
  const sb = createServiceClient();
  const { data } = await sb.from("subscriptions").select("plan_key, status").eq("org_id", orgId)
    .in("status", ["ativa", "trial"]).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.plan_key as string) || "base";
}

/** Toda a entrega liberada pelo programa (modelo sem mensalidade de plataforma). */
const ALL_DELIVERY: PlanFeatures = {
  playbook: true, consultor: true, sessoes: true, roi: true,
  whitelabel_n2: true, whitelabel_n3: true, governanca_avancada: true,
  limite_membros: 9999, creditos_sessao_mes: 9999,
};

/** Flags de recurso. Sem mensalidade de plataforma → tudo liberado pelo programa (sem gating por plano).
 *  Com PLATFORM_SUBSCRIPTION_ENABLED=true, volta a resolver pelo plano da assinatura ativa (Fase 6). */
export async function getOrgFeatures(orgId: string): Promise<PlanFeatures> {
  if (!platformSubscriptionEnabled()) return ALL_DELIVERY;
  const sb = createServiceClient();
  const key = await getOrgPlanKey(orgId);
  const { data: plan } = await sb.from("plans").select("features").eq("key", key).maybeSingle();
  return { ...BASE_FEATURES, ...((plan?.features as Partial<PlanFeatures>) ?? {}) };
}

/** Gate: a org tem este recurso liberado? (para flags booleanas) */
export async function orgHasFeature(orgId: string, feature: keyof PlanFeatures): Promise<boolean> {
  const f = await getOrgFeatures(orgId);
  return !!f[feature];
}
