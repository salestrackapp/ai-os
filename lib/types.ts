export type CatalogItem = {
  id: string; kind: string; brand: "andre_kachan" | "salestrack" | "ai_os";
  name: string; description: string | null; unit: string;
  price: number | null; cost: number | null;
  active: boolean; needs_review: boolean; created_at: string;
  frentes: string[] | null; internal_notes: string | null;
};
export type BrandAlloc = { brand: string; value: number };
export type Deal = {
  id: string; title: string; stage: string; icp: number | null; score: number;
  value_estimated: number | null; brand: string; org_id: string | null;
  contact_id: string | null; created_at: string;
  last_activity_at: string | null; next_step: string | null; expected_close: string | null;
  signals: string[] | null; lost_reason: string | null; brand_split: BrandAlloc[] | null;
};
export type Task = {
  id: string; org_id: string | null; deal_id: string | null; title: string;
  done: boolean; due_date: string | null; created_at: string; completed_at: string | null;
};
/** Alocação por marca de um deal: usa brand_split se houver; senão, marca única com o valor total. */
export function dealBrandValues(d: Deal): BrandAlloc[] {
  if (d.brand_split && d.brand_split.length > 0) return d.brand_split.filter((a) => a && a.brand);
  return [{ brand: d.brand, value: d.value_estimated ?? 0 }];
}
export type SignalDefinition = {
  id: string; label: string; weight: number; active: boolean; sort: number;
};
export type Contact = {
  id: string; org_id: string | null; name: string; email: string | null;
  phone: string | null; role: string | null; opt_in_whatsapp: boolean; created_at: string;
};
export type Organization = {
  id: string; name: string; slug: string; cnpj: string | null;
  plan: string; status: string; icp: number | null; is_salestrack: boolean; created_at: string;
};

export const DEAL_STAGES = ["sinal","qualificado","diagnostico","proposta","fechamento","cliente"] as const;
export const STAGE_LABELS: Record<string,string> = {
  sinal: "Sinal", qualificado: "Qualificado", diagnostico: "Diagnóstico",
  proposta: "Proposta", fechamento: "Fechamento", cliente: "Cliente", perdido: "Perdido",
};
/** Probabilidade de fechamento por estágio (pipeline ponderado). */
export const STAGE_PROB: Record<string, number> = {
  sinal: 0.05, qualificado: 0.15, diagnostico: 0.30, proposta: 0.50, fechamento: 0.75, cliente: 1, perdido: 0,
};
export const BRAND_LABELS: Record<string,string> = {
  andre_kachan: "André Kachan", salestrack: "Salestrack AI", ai_os: "AI OS",
};
export const KIND_LABELS: Record<string,string> = {
  mentoria: "Mentoria", workshop: "Workshop", palestra: "Palestra", treinamento: "Treinamento",
  produto: "Produto", agente: "Agente", plano_aios: "Plano AI OS", addon: "Add-on",
};
export const ORG_PLAN_LABELS: Record<string,string> = {
  essential: "Essential", professional: "Professional", enterprise: "Enterprise",
};
export const ORG_STATUS_LABELS: Record<string,string> = {
  prospect: "Prospect", onboarding: "Onboarding", ativo: "Ativo", pausado: "Pausado", encerrado: "Encerrado",
};
export const MEMBERSHIP_ROLES: Record<string,string> = {
  salestrack_admin: "Admin Salestrack", sponsor: "Sponsor", gestor_frente: "Gestor de frente",
  colaborador: "Colaborador", financeiro: "Financeiro",
};
export type ProposalItem = { catalog_item_id?: string | null; name: string; qty: number; price: number; brand: string };
export type TimelinePhase = { n: number; titulo: string; meses: number; descricao: string };
export type Proposal = {
  id: string; org_id: string | null; deal_id: string | null; version: number; status: string;
  title: string; frentes: string[] | null; items: ProposalItem[] | null;
  platform_plan_md: string | null; monthly_platform_fee: number | null; installments: number | null;
  html: string | null; content_hash: string | null; sent_at: string | null; decided_at: string | null;
  read_analytics: unknown; decision_note: string | null; created_at: string;
  access_token: string | null; valid_until: string | null; timeline: TimelinePhase[] | null;
  roi_note: string | null; conditions_md: string | null; client_name: string | null; client_email: string | null;
};
export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho", enviada: "Enviada", em_leitura: "Em leitura", aprovada: "Aprovada",
  ajuste_solicitado: "Ajuste solicitado", recusada: "Recusada", expirada: "Expirada",
};
export function proposalStatusBadge(s: string): string {
  if (s === "aprovada") return "badge-teal";
  if (s === "recusada" || s === "expirada") return "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10";
  if (s === "enviada" || s === "em_leitura" || s === "ajuste_solicitado") return "badge-gold";
  return "badge-muted";
}
/** Soma por marca dos itens de uma proposta (colunas duplas AK × ST). */
export function proposalTotals(items: ProposalItem[]): { byBrand: Record<string, number>; total: number } {
  const byBrand: Record<string, number> = {};
  let total = 0;
  for (const it of items ?? []) {
    const v = (Number(it.qty) || 0) * (Number(it.price) || 0);
    byBrand[it.brand] = (byBrand[it.brand] ?? 0) + v; total += v;
  }
  return { byBrand, total };
}

export const FRENTE_SUGGESTIONS = [
  "Comercial","Marketing","Financeiro","Operações","RH","Jurídico","Atendimento","Diretoria",
];
export const STAGNATION_DAYS = 14;

export function brl(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
/** Dias inteiros desde uma data ISO (usa a última atividade do deal). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
export function isStagnant(d: Deal): boolean {
  const days = daysSince(d.last_activity_at);
  return days !== null && days >= STAGNATION_DAYS && d.stage !== "cliente" && d.stage !== "perdido";
}
