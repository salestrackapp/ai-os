import { z } from "zod";
import { defineLine } from "../define-line";

/**
 * LINHA DE REFERÊNCIA (R3.1) — "Dica do programa".
 * Um one-pager acionável gerado a partir do contexto interno do programa.
 * Existe para PROVAR o núcleo (gerar→revisar→aprovar→publicar→versão); as linhas reais chegam em R3.2+.
 */
export const dicaSchema = z.object({
  titulo: z.string().min(3).max(240),
  contexto: z.string().min(10).max(4000),
  passos: z.array(z.string().min(3).max(600)).min(2).max(10),
  impacto: z.string().min(5).max(2000),
  indicador: z.object({ label: z.string().min(1).max(120), value: z.string().min(1).max(120) }).optional().catch(undefined),
});
export type DicaContent = z.infer<typeof dicaSchema>;

export const dicaLine = defineLine<DicaContent>({
  key: "dica",
  label: "Dica do programa",
  description: "One-pager acionável com um próximo passo do programa, gerado do contexto interno.",
  family: "documentos",
  brandDefault: "salestrack",
  kind: "one_pager",
  renderTarget: "pdf",
  contentSchema: dicaSchema,
  buildPrompt: (ctx) => [
    "Você é o Estúdio de Conteúdo da Salestrack. Produza uma DICA DO PROGRAMA: um one-pager curto e acionável",
    "que ajude a equipe do cliente a dar o próximo passo prático no programa de IA, usando SOMENTE o contexto abaixo.",
    ctx.brief ? `Foco pedido pelo consultor: ${ctx.brief}` : "",
    "",
    "Responda ESTRITAMENTE em JSON válido (sem markdown, sem cercas de código) com o formato:",
    '{ "titulo": string, "contexto": string, "passos": string[] (3 a 6), "impacto": string, "indicador"?: { "label": string, "value": string } }',
    "Regras: português brasileiro, tom de copiloto (próximo e prático); nunca invente números, datas ou entregas fora do contexto.",
    "",
    "=== CONTEXTO INTERNO DO PROGRAMA (apenas deste cliente) ===",
    ctx.rag,
  ].filter(Boolean).join("\n"),
  toContent: (d, ctx) => ({
    cover: {
      eyebrow: "Dica do programa",
      title: d.titulo,
      subtitle: ctx.orgName,
      meta: ["Salestrack AI", "One-pager acionável"],
    },
    summary: d.contexto,
    kpis: d.indicador ? [{ label: d.indicador.label, value: d.indicador.value }] : undefined,
    sections: [
      { id: "passos", eyebrow: "Como fazer", title: "Próximos passos", bullets: d.passos },
      { id: "impacto", eyebrow: "Por que importa", title: "Impacto esperado", body: d.impacto },
    ],

  }),
});
