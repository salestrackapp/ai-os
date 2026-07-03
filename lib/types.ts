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
export type ProposalItem = { catalog_item_id?: string | null; name: string; qty: number; price: number; brand: string; description?: string | null };
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

export type Contract = {
  id: string; org_id: string | null; proposal_id: string | null; status: string;
  docusign_envelope_id: string | null; signed_pdf_url: string | null; content_hash: string | null;
  signed_at: string | null; created_at: string; content_html: string | null; sent_at: string | null;
  signer_name: string | null; signer_email: string | null; signed_manually: boolean;
};
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  minuta: "Minuta", enviado: "Enviado", assinado: "Assinado", cancelado: "Cancelado",
};
export function contractStatusBadge(s: string): string {
  if (s === "assinado") return "badge-teal";
  if (s === "cancelado") return "badge inline-flex text-[10px] uppercase tracking-[.14em] px-2.5 py-1 rounded-full border text-red-400 border-red-500/40 bg-red-500/10";
  if (s === "enviado") return "badge-gold";
  return "badge-muted";
}
export type Invoice = {
  id: string; org_id: string; stripe_invoice_id: string | null; amount: number | null; status: string | null;
  due_date: string | null; paid_at: string | null; kind: string; installment_n: number | null;
  installments_total: number | null; contract_id: string | null; hosted_url: string | null;
};
export type Subscription = {
  id: string; org_id: string; stripe_subscription_id: string | null; plan: string; monthly_amount: number | null;
  addons: unknown; status: string; started_at: string; contract_id: string | null;
};

export type Project = {
  id: string; org_id: string | null; contract_id: string | null; name: string; phase: string;
  timeline: TimelinePhase[] | null; progress_pct: number; health_score: number | null; created_at: string;
  kickoff_checklist: unknown; status: string; activated_at: string | null; activated_by: string | null;
};
export type Deliverable = {
  id: string; project_id: string; org_id: string; frente: string | null; title: string;
  status: string; due_date: string | null; delivered_at: string | null; artifact_asset_id: string | null;
};
export type LibraryAsset = {
  id: string; org_id: string | null; type: string; frente: string | null; title: string;
  version: number; storage_path: string | null; url: string | null; meta: unknown; created_at: string;
};
export type Session = {
  id: string; org_id: string; type: string; brand: string; title: string; status: string;
  scheduled_at: string | null; meet_link: string | null; created_at: string;
};
export type Invite = {
  id: string; org_id: string; email: string; role: string; token: string;
  invited_by: string | null; expires_at: string; accepted_at: string | null; created_at: string;
};
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding", ativo: "Ativo", pausado: "Pausado", encerrado: "Encerrado",
};
export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado", em_andamento: "Em andamento", entregue: "Entregue",
  entregue_pelo_cliente: "Entregue pelo cliente", bloqueado: "Bloqueado",
};
export const ASSET_TYPE_LABELS: Record<string, string> = {
  documento: "Documento", video: "Vídeo", gravacao: "Gravação", material: "Material",
  skill: "Skill", prompt: "Prompt", playbook: "Playbook", automacao: "Automação",
};
export const CLIENT_ROLE_LABELS: Record<string, string> = {
  client_admin: "Administrador", client_member: "Membro",
};

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
