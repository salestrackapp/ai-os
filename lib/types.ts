export type CatalogItem = {
  id: string; kind: string; brand: "andre_kachan" | "salestrack" | "ai_os";
  name: string; description: string | null; unit: string;
  price: number | null; cost: number | null;
  active: boolean; needs_review: boolean; created_at: string;
};
export type Deal = {
  id: string; title: string; stage: string; icp: number | null; score: number;
  value_estimated: number | null; brand: string; org_id: string | null;
  contact_id: string | null; created_at: string;
};
export const DEAL_STAGES = ["sinal","qualificado","diagnostico","proposta","fechamento","cliente"] as const;
export const STAGE_LABELS: Record<string,string> = {
  sinal: "Sinal", qualificado: "Qualificado", diagnostico: "Diagnóstico",
  proposta: "Proposta", fechamento: "Fechamento", cliente: "Cliente", perdido: "Perdido",
};
export const BRAND_LABELS: Record<string,string> = {
  andre_kachan: "André Kachan", salestrack: "Salestrack AI", ai_os: "AI OS",
};
export const KIND_LABELS: Record<string,string> = {
  mentoria: "Mentoria", workshop: "Workshop", palestra: "Palestra", treinamento: "Treinamento",
  produto: "Produto", agente: "Agente", plano_aios: "Plano AI OS", addon: "Add-on",
};
export function brl(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
