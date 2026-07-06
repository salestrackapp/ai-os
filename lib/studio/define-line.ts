import type { z } from "zod";
import type { DeliverableContent, DeliverableFormat, DeliverableKind } from "@/lib/deliverables/types";

/** Atribuição de marca (logo/assinatura/autoria) — NÃO troca o design, que é sempre Salestrack AI v2. */
export type LineBrand = "salestrack" | "andre_kachan";

/** Famílias do catálogo do Estúdio (R3.2). Aprofundadas em R3.3–R3.8. */
export type FamilyKey = "documentos" | "apresentacoes" | "formacao" | "mensagens" | "arte" | "video";

export const FAMILIES: { key: FamilyKey; label: string; icon: string; desc: string; deepen: string }[] = [
  { key: "documentos", label: "Documentos & Publicações", icon: "fileText", desc: "Relatórios, ebooks, playbooks, propostas e one-pagers.", deepen: "R3.3" },
  { key: "apresentacoes", label: "Apresentações", icon: "layers", desc: "Decks executivos + base de slides reutilizável.", deepen: "R3.4" },
  { key: "formacao", label: "Formação", icon: "graduation", desc: "Workshops, cursos, treinamentos e palestras (testes/certificados).", deepen: "R3.5" },
  { key: "mensagens", label: "Mensagens & Copy", icon: "chat", desc: "Posts, mensagens, WhatsApp e e-mails de marketing.", deepen: "R3.6" },
  { key: "arte", label: "Arte & Criativos", icon: "gem", desc: "Artes e criativos de posts (briefing + specs).", deepen: "R3.7" },
  { key: "video", label: "Vídeo", icon: "eye", desc: "Roteiro + storyboard (render pelas ferramentas de vídeo).", deepen: "R3.8" },
];

/** Contexto que o motor entrega para a linha ao gerar (dados INTERNOS do programa, RAG). */
export type LineContext = {
  orgId: string;
  orgName: string;
  projectId?: string | null;
  phaseIndex?: number | null;
  rag: string;            // contexto interno já montado (buildClientContext)
  brief?: string | null;  // pedido/observação humana opcional
};

/**
 * Descritor de uma LINHA de produção do Estúdio.
 * As linhas R3.2–R3.8 só fornecem ISTO — o COMO (gerar/revisar/aprovar/render/versão) mora no engine.
 *  · contentSchema: valida o JSON estruturado que a IA devolve.
 *  · buildPrompt: monta o pedido de geração com o RAG interno.
 *  · toContent: mapeia o conteúdo da linha → DeliverableContent canônico (render marca-dupla da Fase B).
 */
export type LineDef<T> = {
  key: string;
  label: string;                    // PT-BR
  description: string;              // o que a linha produz (para a UI/estados vazios)
  family: FamilyKey;                // família do catálogo (R3.2)
  brandDefault: LineBrand;          // atribuição padrão (logo/assinatura) — NÃO é design
  kind: DeliverableKind;            // reaproveita template/render da Fase B
  renderTarget: DeliverableFormat;  // pdf | pptx | html
  templateKey?: string;             // opcional: força um template específico
  commChannel?: "whatsapp" | "email" | "post" | "generic"; // famílias de mensagens → elegível ao R4
  deepenedIn?: string;              // marca componentes especializados (ex.: "R3.7") — baseline aqui
  // input `any`: schemas usam .catch() (input difere do output) para tolerar geração da IA.
  contentSchema: z.ZodType<T, z.ZodTypeDef, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  buildPrompt: (ctx: LineContext) => string;
  toContent: (data: T, ctx: LineContext) => DeliverableContent;
};

export function defineLine<T>(def: LineDef<T>): LineDef<T> {
  return def;
}

// ── Registro global (name → def). Espelha a filosofia do kit CRUD (R2.1). ──
/* eslint-disable @typescript-eslint/no-explicit-any */
const REGISTRY = new Map<string, LineDef<any>>();

export function registerLine(def: LineDef<any>): void {
  REGISTRY.set(def.key, def);
}
export function getLine(key: string): LineDef<any> | undefined {
  return REGISTRY.get(key);
}
export function allLines(): LineDef<any>[] {
  return [...REGISTRY.values()];
}
export function linesInFamily(family: FamilyKey): LineDef<any>[] {
  return allLines().filter((l) => l.family === family);
}
