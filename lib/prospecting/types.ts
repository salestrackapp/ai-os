export type ProspectAccount = {
  id: string; name: string; domain: string | null; size: string | null; industry: string | null;
  icp: string | null; signals: string[] | null; score: number; apollo_id: string | null; source: string | null; owner: string | null; created_at: string;
};
export type Prospect = {
  id: string; account_id: string | null; name: string; title: string | null; seniority: string | null;
  icp: string | null; email: string | null; phone: string | null; linkedin_url: string | null; apollo_id: string | null;
  score: number; status: string; dossier_md: string | null; source: string; deal_id: string | null; created_at: string;
};
export type Cadence = { id: string; name: string; icp: string | null; steps: CadenceStep[]; is_active: boolean };
export type CadenceStep = { dia: number; canal: "email" | "whatsapp" | "linkedin" | "ligacao"; tipo: "toque" | "tarefa"; modelo: string };
export type CadenceEnrollment = { id: string; prospect_id: string; cadence_id: string; current_step: number; status: string; next_action_at: string | null; enrolled_at: string };
export type OutreachMessage = { id: string; prospect_id: string; channel: string; subject: string | null; body: string | null; variant: string | null; agent_generated: boolean; status: string; approved_by: string | null; sent_at: string | null; created_at: string };
export type TimelineEvent = { id: string; subject_type: string; subject_id: string; source: string; kind: string; summary: string | null; occurred_at: string; external_ref: string | null };

export const ICP_LABELS: Record<string, string> = {
  icp1: "ICP 1 · CEOs/Founders (médias)",
  icp2: "ICP 2 · Vendas+Mkt (PME)",
  icp3: "ICP 3 · Ops+Finanças (enterprise)",
};
export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  novo: "Novo", qualificado: "Qualificado", em_cadencia: "Em cadência", respondeu: "Respondeu",
  reuniao: "Reunião", descartado: "Descartado", virou_deal: "Virou deal",
};
export const CHANNEL_LABELS: Record<string, string> = { email: "E-mail", whatsapp: "WhatsApp", linkedin: "LinkedIn", ligacao: "Ligação" };
export const OUTREACH_STATUS_LABELS: Record<string, string> = { rascunho: "Rascunho", aprovada: "Aprovada", enviada: "Enviada", reprovada: "Reprovada" };
