// Modelo canônico de documento executivo do Estúdio de Entregáveis.
// Genérico o suficiente para todos os `kind` (proposta, roi, dossiê, relatório, sessão, one-pager, apresentação).

export type KPI = { label: string; value: string; hint?: string };

export type DeliverableTable = { head: string[]; rows: string[][]; foot?: string[] };

/** Bloco de dado: número grande como prova + legenda (R3.3). */
export type DataFigure = { value: string; label: string; caption?: string };
/** Citação/destaque. */
export type Quote = { text: string; author?: string };
/** Gráfico simples de barras (SVG inline, v2). */
export type Chart = { type: "bar"; caption?: string; bars: { label: string; value: number }[] };

export type DeliverableSection = {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;            // prosa (parágrafos separados por \n\n)
  bullets?: string[];
  kpis?: KPI[];
  table?: DeliverableTable;
  figure?: DataFigure;      // R3.3 · bloco de dado (figura grande + legenda)
  quote?: Quote;            // R3.3 · citação/destaque
  chart?: Chart;            // R3.3 · gráfico simples
};

/** Apresentações (R3.4) — deck de slides com layout + conteúdo + notas do apresentador. */
export type SlideLayout = "capa" | "divisor" | "conteudo" | "estatistica" | "citacao" | "comparacao" | "imagem" | "encerramento";
export type DeckColumn = { title: string; body?: string; bullets?: string[] };
export type DeckSlide = {
  layout: SlideLayout;
  eyebrow?: string;
  title?: string;
  body?: string;
  bullets?: string[];
  stat?: DataFigure;        // slide de estatística (número como prova)
  quote?: Quote;
  columns?: DeckColumn[];   // comparação / duas colunas
  image?: string;           // url (opcional)
  cta?: string;             // encerramento
  notes?: string;           // notas do apresentador (vão para o PPTX)
};
export type Deck = { title: string; slides: DeckSlide[] };

/** Formação (R3.5) — payload estruturado do agregado (não renderizado; alimenta slides/teste/certificado). */
export type FormacaoModulo = { titulo: string; objetivo?: string; tempo?: string; topicos?: string[] };
export type FormacaoPayload = { tipo: string; objetivos: string; publico?: string; carga_horaria?: string; modulos: FormacaoModulo[]; teste?: unknown };

/** Mensagens & Copy (R3.6) — payloads de canal (carregam metadados para a Comunicação/R4). */
export type EmailPayload = { assunto: string; preheader?: string; corpo: string[]; cta?: { label: string; url?: string }; variaveis?: string[] };
export type MessagePayload = { canal: "post" | "mensagem" | "whatsapp" | "email"; plataforma?: string; texto: string; variaveis?: string[]; hashtags?: string[]; sugestao_visual?: string; cta?: string; variantes?: string[] };

/** Arte & Criativos (R3.7) — criativo por template v2 → PNG, em preset de tamanho. */
export type CreativeSize = "1:1" | "4:5" | "9:16" | "16:9";
export type CreativeTemplate = "citacao" | "numero" | "anuncio" | "carrossel" | "capa" | "thumbnail";
export type CreativeSlide = { headline?: string; copy?: string; dado?: DataFigure; autor?: string; cta?: string };
/** Vídeo (R3.8) — roteiro + storyboard. Render nas ferramentas da Salestrack (graceful). */
export type VideoScene = { visual: string; duracao?: string; narracao?: string; texto_tela?: string; arte?: CreativeSlide };
export type VideoPayload = { tipo: string; roteiro: { narracao: string[]; textos_tela: string[] }; storyboard: VideoScene[]; voiceover?: string };

export type CreativePayload = CreativeSlide & {
  template: CreativeTemplate;
  tamanho: CreativeSize;
  imagem_fundo?: string;        // url opcional (camada de imagem por IA); senão fundo v2
  slides?: CreativeSlide[];     // carrossel
  postRef?: string;             // vínculo com o post (R3.6) → publicar juntos no R4
};

export type DeliverableContent = {
  cover: { eyebrow?: string; title: string; subtitle?: string; meta?: string[] };
  summary?: string;         // sumário executivo (prosa)
  kpis?: KPI[];             // faixa de indicadores logo após o sumário
  toc?: boolean;            // R3.3 · renderiza sumário navegável a partir dos títulos das seções
  sections?: DeliverableSection[];
  deck?: Deck;              // R3.4 · quando presente, o entregável é uma apresentação (slides)
  formacao?: FormacaoPayload; // R3.5 · payload estruturado da formação (slides/teste/certificado)
  email?: EmailPayload;     // R3.6 · e-mail marketing (render HTML MailerLite-ready)
  message?: MessagePayload; // R3.6 · post/mensagem/whatsapp (render texto + variáveis)
  creative?: CreativePayload; // R3.7 · arte/criativo (template v2 → PNG)
  video?: VideoPayload;     // R3.8 · vídeo (roteiro + storyboard → render Salestrack)
  footer?: string;
};

export type BrandScope = "andre_kachan" | "salestrack" | "tenant";
export type DeliverableFormat = "pdf" | "pptx" | "docx" | "html";
export type DeliverableKind =
  | "proposta" | "roi" | "dossie" | "relatorio_frente" | "resumo_sessao" | "one_pager" | "apresentacao";

export type TenantBrand = {
  internal_name?: string | null;
  logo_url?: string | null;
  color_primary?: string | null;
  color_accent?: string | null;
  color_bg?: string | null;
  level?: string | null;
};

export type RenderInput = {
  kind: DeliverableKind;
  brand_scope: BrandScope;          // R3.2: só ATRIBUIÇÃO (logo/assinatura), NUNCA troca o design
  format: DeliverableFormat;
  content: DeliverableContent;
  branding?: TenantBrand | null;    // white-label do tenant (logo do cliente)
  title: string;
  // R3.2 · identidade leve do programa (dentro do v2)
  accent?: string | null;           // acento restrito à paleta v2 (senão ignorado)
  logo?: string | null;             // logo do cliente/programa (capa)
  programName?: string | null;      // nome do programa (capa)
};

/** Paleta de acentos PERMITIDA no design Salestrack AI v2 (identidade do programa nunca sai daqui). */
export const V2_ACCENTS: Record<string, string> = {
  violeta: "#4F1FFF", "violeta-claro": "#8B5CFF", "violeta-profundo": "#3A16C0",
  lime: "#EBF212", ink: "#0B0B16", grafite: "#2A2A3C",
};
export function isV2Accent(hex?: string | null): boolean {
  if (!hex) return false;
  const h = hex.toUpperCase();
  return Object.values(V2_ACCENTS).some((v) => v.toUpperCase() === h);
}

export const KIND_LABELS: Record<DeliverableKind, string> = {
  proposta: "Proposta comercial",
  roi: "Relatório de ROI",
  dossie: "Dossiê de prospect",
  relatorio_frente: "Relatório de frente",
  resumo_sessao: "Resumo executivo de sessão",
  one_pager: "One-pager",
  apresentacao: "Apresentação executiva",
};

export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho", gerando: "Gerando com IA", em_revisao: "Em revisão", aprovado: "Aprovado", entregue: "Entregue", publicado: "Publicado",
};

export const BRAND_LABELS: Record<string, string> = {
  salestrack: "Salestrack AI", andre_kachan: "André Kachan", tenant: "Marca do cliente",
};

/** Assinatura de marca no cabeçalho/rodapé conforme o brand_scope. */
export function brandSignature(scope: BrandScope, branding?: TenantBrand | null): { eyebrow: string; footer: string } {
  if (scope === "andre_kachan") return { eyebrow: "André Kachan · Método", footer: "André Kachan · Salestrack AI" };
  if (scope === "tenant" && branding?.internal_name) return { eyebrow: branding.internal_name, footer: branding.internal_name };
  if (scope === "tenant") return { eyebrow: "Programa de IA", footer: "Powered by AI OS" };
  return { eyebrow: "Salestrack AI · Execução", footer: "Salestrack AI" };
}
