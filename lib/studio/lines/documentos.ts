import { z } from "zod";
import { defineLine } from "../define-line";
import { studioPrompt } from "./schemas";
import { buildDocument, figure, barChart, type DocSection } from "../render/document";

/** Extrai o primeiro número de um texto ("R$ 12,5 mil" → 12.5). null se não houver. */
function parseNum(s: string): number | null {
  const m = s.replace(/\./g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Família A · Documentos & Publicações — aprofundada (R3.3). Renderer compartilhado + v2 + identidade. */

// ── Relatório: resumo + seções + dados (números como prova) + conclusões + próximos passos ──
const relatorioSchema = z.object({
  resumo_executivo: z.string().min(10).max(4000),
  secoes: z.array(z.object({ titulo: z.string().min(2).max(240), corpo: z.string().max(6000).optional().catch(undefined), bullets: z.array(z.string().min(1).max(600)).max(20).optional().catch(undefined) })).min(1).max(16),
  dados: z.array(z.object({ metrica: z.string().min(1).max(120), valor: z.string().min(1).max(60), legenda: z.string().max(300).optional().catch(undefined) })).max(8).optional().catch(undefined),
  conclusoes: z.string().max(4000).optional().catch(undefined),
  proximos_passos: z.array(z.string().min(1).max(600)).max(12).optional().catch(undefined),
});

const relatorio = defineLine({
  key: "relatorio", label: "Relatório", description: "Relatório executivo com dados reais, conclusões e próximos passos.",
  family: "documentos", brandDefault: "salestrack", kind: "relatorio_frente", renderTarget: "pdf", contentSchema: relatorioSchema,
  buildPrompt: (ctx) => studioPrompt(
    "Produza um RELATÓRIO EXECUTIVO do programa: resumo executivo, seções analíticas, DADOS reais (métrica/valor/legenda — use SOMENTE números do contexto; se não houver, deixe 'dados' vazio), conclusões e próximos passos.",
    '{ "resumo_executivo": string, "secoes": [{ "titulo": string, "corpo"?: string, "bullets"?: string[] }], "dados"?: [{ "metrica": string, "valor": string, "legenda"?: string }], "conclusoes"?: string, "proximos_passos"?: string[] }',
    ctx),
  toContent: (d, ctx) => {
    const secs: DocSection[] = d.secoes.map((s) => ({ title: s.titulo, body: s.corpo, bullets: s.bullets }));
    const dados = d.dados ?? [];
    if (dados[0]) secs.push({ eyebrow: "Números como prova", title: "Resultados", figure: figure(dados[0].valor, dados[0].metrica, dados[0].legenda),
      chart: dados.length > 1 && dados.every((x) => parseNum(x.valor) != null) ? barChart(dados.map((x) => ({ label: x.metrica.slice(0, 14), value: parseNum(x.valor)! })), "Indicadores do período") : undefined });
    if (d.conclusoes) secs.push({ eyebrow: "Conclusões", title: "O que os dados dizem", body: d.conclusoes });
    if (d.proximos_passos?.length) secs.push({ eyebrow: "A seguir", title: "Próximos passos", bullets: d.proximos_passos });
    return buildDocument({ eyebrow: "Relatório executivo", title: `Relatório · ${ctx.orgName}`, subtitle: ctx.orgName, meta: ["Salestrack AI", "Relatório"], summary: d.resumo_executivo, sections: secs });
  },
});

// ── Ebook: capa + sumário + capítulos + fechamento ──
const ebookSchema = z.object({
  subtitulo: z.string().max(240).optional().catch(undefined),
  capitulos: z.array(z.object({ titulo: z.string().min(2).max(240), corpo: z.string().min(10).max(8000) })).min(2).max(16),
  fechamento: z.string().min(5).max(4000),
});
const ebook = defineLine({
  key: "ebook", label: "Ebook", description: "Ebook de autoridade: capa, sumário, capítulos e fechamento.",
  family: "documentos", brandDefault: "andre_kachan", kind: "one_pager", renderTarget: "pdf", contentSchema: ebookSchema,
  buildPrompt: (ctx) => studioPrompt(
    "Produza um EBOOK de autoridade sobre um tema central do programa: subtítulo, 3–6 capítulos (título + corpo em prosa) e um fechamento acionável.",
    '{ "subtitulo"?: string, "capitulos": [{ "titulo": string, "corpo": string }], "fechamento": string }', ctx),
  toContent: (d, ctx) => buildDocument({
    eyebrow: "Ebook", title: ctx.orgName ? `Ebook · ${ctx.orgName}` : "Ebook", subtitle: d.subtitulo ?? ctx.orgName, meta: ["André Kachan", "Guia"],
    sections: [...d.capitulos.map((c, i) => ({ eyebrow: `Capítulo ${i + 1}`, title: c.titulo, body: c.corpo })), { eyebrow: "Fechamento", title: "Para levar adiante", body: d.fechamento }],
    toc: true,
  }),
});

// ── Playbook: objetivo + receitas (reusa as 20 receitas da Fase 5 via contexto) ──
const playbookSchema = z.object({
  objetivo: z.string().min(10).max(2000),
  receitas: z.array(z.object({ titulo: z.string().min(2).max(240), quando_usar: z.string().max(600).optional().catch(undefined), passos: z.array(z.string().min(1).max(600)).min(1).max(20), resultado: z.string().max(600).optional().catch(undefined) })).min(1).max(20),
});
const playbook = defineLine({
  key: "playbook_doc", label: "Playbook", description: "Playbook operacional composto a partir das receitas do Playbook (Fase 5).",
  family: "documentos", brandDefault: "andre_kachan", kind: "one_pager", renderTarget: "pdf", contentSchema: playbookSchema,
  buildPrompt: (ctx) => studioPrompt(
    "Produza um PLAYBOOK operacional REAPROVEITANDO as Receitas do Playbook listadas no contexto (não invente novas): objetivo geral e, para cada receita escolhida, passos, quando usar e resultado esperado.",
    '{ "objetivo": string, "receitas": [{ "titulo": string, "quando_usar"?: string, "passos": string[], "resultado"?: string }] }', ctx),
  toContent: (d, ctx) => buildDocument({
    eyebrow: "Playbook", title: ctx.orgName ? `Playbook · ${ctx.orgName}` : "Playbook", subtitle: ctx.orgName, meta: ["André Kachan", "Playbook"],
    summary: d.objetivo,
    sections: d.receitas.map((r, i) => ({ eyebrow: `Receita ${i + 1}`, title: r.titulo, body: [r.quando_usar ? `Quando usar: ${r.quando_usar}` : "", r.resultado ? `Resultado esperado: ${r.resultado}` : ""].filter(Boolean).join("\n\n") || undefined, bullets: r.passos })),
    toc: true,
  }),
});

// ── Proposta / one-pager: oferta do catálogo → escopo/timeline/valor/termos (modelo corrigido) ──
const propostaSchema = z.object({
  oferta: z.string().min(2).max(160),
  contexto_cliente: z.string().min(10).max(3000),
  escopo: z.array(z.string().min(1).max(600)).min(1).max(20),
  linha_do_tempo: z.array(z.object({ fase: z.string().min(1).max(160), quando: z.string().max(120).optional().catch(undefined) })).max(12).optional().catch(undefined),
  valor: z.string().min(1).max(120),
  termos: z.array(z.string().min(1).max(600)).max(12).optional().catch(undefined),
});
const proposta = defineLine({
  key: "proposta_doc", label: "Proposta / One-pager", description: "Proposta de uma oferta do catálogo: escopo, linha do tempo, valor e termos.",
  family: "documentos", brandDefault: "salestrack", kind: "proposta", renderTarget: "pdf", contentSchema: propostaSchema,
  buildPrompt: (ctx) => studioPrompt(
    "Produza uma PROPOSTA COMERCIAL a partir de UMA oferta do catálogo (listadas no contexto): nome da oferta, contexto do cliente, escopo, linha do tempo, valor (da oferta) e termos. IMPORTANTE: é oferta entregue no AI OS, NÃO plano/assinatura de plataforma.",
    '{ "oferta": string, "contexto_cliente": string, "escopo": string[], "linha_do_tempo"?: [{ "fase": string, "quando"?: string }], "valor": string, "termos"?: string[] }', ctx),
  toContent: (d, ctx) => {
    const secs: DocSection[] = [
      { eyebrow: "Oferta", title: d.oferta, body: "Oferta entregue no AI OS — provisiona o programa do cliente ao ser fechada. Não é plano nem assinatura de plataforma." },
      { eyebrow: "Escopo", title: "O que está incluído", bullets: d.escopo },
    ];
    if (d.linha_do_tempo?.length) secs.push({ eyebrow: "Linha do tempo", title: "Como avançamos", bullets: d.linha_do_tempo.map((f) => `${f.fase}${f.quando ? ` — ${f.quando}` : ""}`) });
    secs.push({ eyebrow: "Investimento", title: "Valor", figure: figure(d.valor, "Investimento da oferta", "Entregue no AI OS · sem mensalidade de plataforma") });
    if (d.termos?.length) secs.push({ eyebrow: "Termos", title: "Condições", bullets: d.termos });
    return buildDocument({ eyebrow: "Proposta comercial", title: `Proposta · ${ctx.orgName}`, subtitle: ctx.orgName, meta: ["Salestrack AI", "Proposta"], summary: d.contexto_cliente, sections: secs });
  },
});

export const documentosLines = [relatorio, ebook, playbook, proposta];
