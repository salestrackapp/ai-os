/** Catálogo de tipos de entregável do Estúdio (UC) — PURO/testável. `key` grava em studio_deliverables.kind. */

export type FamiliaKey = "aprendizagem" | "midia" | "documentos" | "produtos" | "executivo";
export type ConsumoKey = "passo_a_passo" | "midia" | "externo" | "single";

export type TipoDef = {
  key: string;
  familia: FamiliaKey;
  label: string;
  icone: string;
  formatos: string[];
  consumo: ConsumoKey;
  compartilhavel: boolean;
};

export const FAMILIAS: { key: FamiliaKey; label: string; icone: string }[] = [
  { key: "aprendizagem", label: "Aprendizagem & capacitação", icone: "book" },
  { key: "midia", label: "Conteúdo & mídia", icone: "sparkles" },
  { key: "documentos", label: "Documentos & dados", icone: "fileText" },
  { key: "produtos", label: "Produtos digitais & IA", icone: "rocket" },
  { key: "executivo", label: "Executivo & consultoria", icone: "trending" },
];

const T = (key: string, familia: FamiliaKey, label: string, consumo: ConsumoKey, formatos: string[], icone = "fileText", compartilhavel = true): TipoDef =>
  ({ key, familia, label, consumo, formatos, icone, compartilhavel });

export const DELIVERABLE_TYPES: TipoDef[] = [
  // Aprendizagem
  T("curso", "aprendizagem", "Curso (vídeo · slides · texto)", "passo_a_passo", ["curso", "video", "slides"], "book"),
  T("treinamento", "aprendizagem", "Treinamento", "passo_a_passo", ["curso", "video"], "book"),
  T("trilha", "aprendizagem", "Trilha de aprendizagem", "passo_a_passo", ["curso"], "book"),
  T("workshop", "aprendizagem", "Workshop", "passo_a_passo", ["curso", "slides"], "book"),
  T("playbook", "aprendizagem", "Playbook (passo a passo)", "passo_a_passo", ["doc", "curso"], "book"),
  T("ebook", "aprendizagem", "eBook", "single", ["pdf", "doc"], "book"),
  T("mapa_mental", "aprendizagem", "Mapa mental", "single", ["imagem", "doc"], "book"),
  T("webinar", "aprendizagem", "Webinar / live", "midia", ["video"], "book"),
  T("certificado", "aprendizagem", "Certificado", "single", ["pdf"], "book"),
  // Conteúdo & mídia
  T("video", "midia", "Vídeo", "midia", ["video"], "sparkles"),
  T("podcast", "midia", "Podcast", "midia", ["audio"], "sparkles"),
  T("imagem", "midia", "Imagem / peça visual", "single", ["imagem"], "sparkles"),
  T("infografico", "midia", "Infográfico", "single", ["imagem", "pdf"], "sparkles"),
  T("newsletter", "midia", "Newsletter / sequência", "single", ["doc", "email"], "sparkles"),
  T("roteiro", "midia", "Roteiro (script)", "single", ["doc"], "sparkles"),
  // Documentos & dados
  T("documento", "documentos", "Documento", "single", ["doc", "pdf"], "fileText"),
  T("planilha", "documentos", "Planilha", "externo", ["planilha"], "fileText"),
  T("dashboard", "documentos", "Dashboard / painel", "externo", ["app"], "fileText"),
  T("calculadora", "documentos", "Calculadora", "externo", ["app"], "fileText"),
  T("checklist", "documentos", "Checklist", "single", ["doc"], "fileText"),
  T("template", "documentos", "Template / modelo", "single", ["doc", "planilha"], "fileText"),
  // Produtos digitais & IA
  T("aplicacao", "produtos", "Aplicação", "externo", ["app"], "rocket"),
  T("agente_ia", "produtos", "Agente de IA (WhatsApp 24h)", "externo", ["app"], "rocket"),
  T("automacao", "produtos", "Automação / fluxo", "externo", ["app"], "rocket"),
  T("site", "produtos", "Site / landing page", "externo", ["app"], "rocket"),
  T("prompts", "produtos", "Biblioteca de prompts", "single", ["doc"], "rocket"),
  // Executivo & consultoria
  T("diagnostico", "executivo", "Diagnóstico", "single", ["doc", "pdf"], "trending"),
  T("dossie", "executivo", "Dossiê / relatório", "single", ["doc", "pdf"], "trending"),
  T("roi", "executivo", "ROI & resultados", "single", ["doc", "pdf"], "trending"),
  T("proposta", "executivo", "Proposta comercial", "single", ["doc", "pdf"], "trending"),
  T("deck", "executivo", "Apresentação / deck", "single", ["slides", "pdf"], "trending"),
];

const BY_KEY = new Map(DELIVERABLE_TYPES.map((t) => [t.key, t]));
const FALLBACK: TipoDef = T("documento", "documentos", "Documento", "single", ["doc"], "fileText");

/** Definição de um tipo pelo kind (fallback para documento). */
export function tipoDef(kind: string | null | undefined): TipoDef {
  return (kind && BY_KEY.get(kind)) || FALLBACK;
}
/** Tipos agrupados por família (para o seletor). */
export function tiposPorFamilia(): { familia: FamiliaKey; label: string; icone: string; tipos: TipoDef[] }[] {
  return FAMILIAS.map((f) => ({ familia: f.key, label: f.label, icone: f.icone, tipos: DELIVERABLE_TYPES.filter((t) => t.familia === f.key) }));
}
export function isPassoAPasso(kind: string | null | undefined): boolean {
  return tipoDef(kind).consumo === "passo_a_passo";
}
export function familiaLabel(key: string): string {
  return FAMILIAS.find((f) => f.key === key)?.label ?? key;
}

/** % de módulos concluídos (puro). */
export function progressoModulos(total: number, concluidos: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(concluidos, total) / total) * 100);
}

/** Rótulo curto de cada etapa da jornada (para seletores). */
export const STAGE_HINT: Record<number, string> = {
  1: "Captar", 2: "Diagnóstico", 3: "Construção", 4: "Go-live", 5: "Sprint", 6: "Recorrência",
};

/** Tipo sugerido pela etapa da jornada (1..6) — para o "+ Entregável nesta etapa". */
export function tipoSugeridoPorEtapa(etapa: number): string {
  switch (etapa) {
    case 2: return "diagnostico";
    case 3: return "site";
    case 4: return "video";
    case 5: return "treinamento";
    case 6: return "roi";
    default: return "documento";
  }
}
