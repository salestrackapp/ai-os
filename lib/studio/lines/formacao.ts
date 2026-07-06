import { z } from "zod";
import { defineLine, type LineBrand, type LineContext } from "../define-line";
import { studioPrompt } from "./schemas";
import { buildDocument, type DocSection } from "../render/document";
import { testeSchema } from "../formacao/teste";
import { moduleDeck, slideDivisor, slideConteudo } from "./apresentacoes";
import type { Deck, DeliverableContent, FormacaoPayload, FormacaoModulo } from "@/lib/deliverables/types";

/** Família C · Formação (R3.5) — 4 tipos como PRESETS sobre a mesma base (compõe A/B, + teste + certificado). */

const moduloSchema = z.object({
  titulo: z.string().min(2).max(240),
  objetivo: z.string().max(1000).optional().catch(undefined),
  tempo: z.string().max(60).optional().catch(undefined),
  topicos: z.array(z.string().min(1).max(400)).max(16).optional().catch(undefined),
});
const formacaoSchema = z.object({
  objetivos: z.string().min(10).max(3000),
  publico: z.string().max(600).optional().catch(undefined),
  carga_horaria: z.string().max(60).optional().catch(undefined),
  modulos: z.array(moduloSchema).min(1).max(20),
  teste: testeSchema.optional().catch(undefined),
});
type FormacaoContent = z.infer<typeof formacaoSchema>;

type Preset = { key: string; label: string; brand: LineBrand; comTeste: boolean; desc: string; goal: string };
const PRESETS: Preset[] = [
  { key: "palestra", label: "Palestra", brand: "andre_kachan", comTeste: false, desc: "Sessão única: slides + eventual handout.",
    goal: "Monte a ESTRUTURA DE UMA PALESTRA (sessão única): objetivos, público, e 1–3 blocos como 'módulos' com tópicos. Sem teste." },
  { key: "workshop", label: "Workshop", brand: "andre_kachan", comTeste: false, desc: "Mão na massa: agenda com exercícios.",
    goal: "Monte um WORKSHOP mão-na-massa: objetivos, público, carga horária e módulos com EXERCÍCIOS práticos nos tópicos. Sem teste formal." },
  { key: "treinamento", label: "Treinamento", brand: "andre_kachan", comTeste: true, desc: "Modular + teste + certificado.",
    goal: "Monte um TREINAMENTO modular: objetivos, público, carga horária, módulos e um TESTE (questoes objetivas com gabarito + nota_minima) para certificação." },
  { key: "curso", label: "Curso", brand: "andre_kachan", comTeste: true, desc: "Multi-módulo: currículo + testes + certificado.",
    goal: "Monte um CURSO multi-módulo: currículo completo (objetivos, público, carga horária, módulos com tópicos) e um TESTE final (questoes objetivas com gabarito + nota_minima) para certificação." },
];

const JSON_SHAPE = '{ "objetivos": string, "publico"?: string, "carga_horaria"?: string, "modulos": [{ "titulo": string, "objetivo"?: string, "tempo"?: string, "topicos"?: string[] }], "teste"?: { "nota_minima": number, "questoes": [{ "enunciado": string, "tipo": "multipla|vf|dissertativa", "alternativas"?: string[], "gabarito"?: number|string }] } }';

function toPayload(tipo: string, d: FormacaoContent): FormacaoPayload {
  return { tipo, objetivos: d.objetivos, publico: d.publico, carga_horaria: d.carga_horaria, modulos: d.modulos as FormacaoModulo[], teste: d.teste };
}

function toContent(preset: Preset) {
  return (d: FormacaoContent, ctx: LineContext): DeliverableContent => {
    const secs: DocSection[] = d.modulos.map((m, i) => ({
      eyebrow: `Módulo ${i + 1}${m.tempo ? ` · ${m.tempo}` : ""}`, title: m.titulo,
      body: m.objetivo, bullets: m.topicos,
    }));
    if (d.teste?.questoes?.length) {
      secs.push({
        eyebrow: "Avaliação", title: `Teste${d.teste.titulo ? ` · ${d.teste.titulo}` : ""}`,
        body: `Nota mínima para aprovação: ${d.teste.nota_minima ?? 70}%. As questões objetivas são corrigidas automaticamente.`,
        bullets: d.teste.questoes.map((q, i) => `${i + 1}. ${q.enunciado}${q.alternativas?.length ? ` — (${q.alternativas.join(" / ")})` : ""}`),
      });
    }
    secs.push({ eyebrow: "Certificação", title: "Certificado de conclusão", body: "Ao concluir a formação (e ser aprovado no teste, quando houver), o participante recebe um certificado no design Salestrack AI, com a identidade do programa." });
    const doc = buildDocument({
      eyebrow: `Formação · ${preset.label}`, title: `${preset.label} · ${ctx.orgName}`, subtitle: ctx.orgName,
      meta: [preset.brand === "andre_kachan" ? "André Kachan" : "Salestrack AI", preset.label, ...(d.carga_horaria ? [d.carga_horaria] : [])],
      summary: `${d.objetivos}${d.publico ? `\n\nPúblico-alvo: ${d.publico}` : ""}${d.carga_horaria ? `\nCarga horária: ${d.carga_horaria}` : ""}`,
      sections: secs, toc: true,
    });
    doc.formacao = toPayload(preset.key, d); // payload estruturado p/ slides/teste/certificado
    return doc;
  };
}

export const formacaoLines = PRESETS.map((p) => defineLine({
  key: p.key, label: p.label, description: p.desc, family: "formacao", brandDefault: p.brand,
  kind: "one_pager", renderTarget: "pdf", contentSchema: formacaoSchema, deepenedIn: "R3.5",
  buildPrompt: (ctx) => studioPrompt(p.goal, JSON_SHAPE, ctx),
  toContent: toContent(p),
}));

/**
 * Reuso R3.4: compõe o DECK da formação a partir dos módulos (um divisor + conteúdo por módulo).
 * A Formação ORQUESTRA os ativos (não reimplementa render). Usado para gerar os slides do pacote.
 */
export function composeFormacaoDeck(payload: FormacaoPayload, orgName?: string): Deck {
  const titulo = `${payload.tipo.charAt(0).toUpperCase() + payload.tipo.slice(1)}${orgName ? ` · ${orgName}` : ""}`;
  const partes = payload.modulos.map((m) => [
    slideDivisor(m.titulo, m.tempo ? `Módulo · ${m.tempo}` : "Módulo"),
    slideConteudo(m.objetivo ?? m.titulo, { bullets: m.topicos ?? [] }),
  ]);
  return moduleDeck(titulo, partes);
}
