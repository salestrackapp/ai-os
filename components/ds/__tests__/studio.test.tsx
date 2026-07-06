import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { getLine, allLines, linesInFamily, FAMILIES } from "@/lib/studio/define-line";
import { LAYOUTS, SLIDE_LAYOUTS, composeDeck, slideCapa, slideConteudo } from "@/lib/studio/render/slides/layouts";
import { apresentacaoLine } from "@/lib/studio/lines/apresentacoes";
import { composeFormacaoDeck } from "@/lib/studio/lines/formacao";
import { corrigirTeste } from "@/lib/studio/formacao/teste";
import { buildCertificateHtml } from "@/lib/studio/render/certificate";
import { extractVars, validateMergeFields, detectPII, channelIssues } from "@/lib/studio/copy/channel";
import { buildEmailHtml } from "@/lib/studio/render/email";
import { buildMessageHtml } from "@/lib/studio/render/message";
import { CREATIVE_SIZES, CREATIVE_TEMPLATES, buildCreativeSlideHtml, creativeSlides } from "@/lib/studio/render/creative";
import { creativeFromPost } from "@/lib/studio/lines/arte";
import { buildStoryboardHtml } from "@/lib/studio/render/storyboard";
import { videoToolFor } from "@/lib/studio/video/render-tool";
import { validarGatilho, gatilhoLabel } from "@/lib/comms/triggers";
import { stepCompleteness, instantiateSteps, DEFAULT_REGUA_STEPS, assetTypeIsMessage } from "@/lib/comms/regua";
import { resolveVars, resolveAsset } from "@/lib/comms/resolve-vars";
import { idempotencyKey, isDue } from "@/lib/comms/orchestrate";
import { dicaLine, dicaSchema } from "@/lib/studio/lines/dica";
import "@/lib/studio/lines"; // registra o catálogo
import { buildDeliverableHtml } from "@/lib/deliverables/render/html";
import { brandSignature, isV2Accent } from "@/lib/deliverables/types";

const goodDica = {
  titulo: "Padronize os prompts de atendimento",
  contexto: "A equipe usa prompts soltos; padronizar acelera o Playbook.",
  passos: ["Escolha 1 receita", "Adapte ao seu contexto", "Rode com 2 pessoas"],
  impacto: "Menos retrabalho e respostas mais consistentes.",
  indicador: { label: "Tempo economizado", value: "3h/sem" },
};

describe("R3.1 · define-line + linha de referência", () => {
  it("registra a linha 'dica'", () => {
    expect(getLine("dica")).toBeTruthy();
    expect(dicaSchema.safeParse(goodDica).success).toBe(true);
    expect(dicaSchema.safeParse({ ...goodDica, passos: ["só um"] }).success).toBe(false);
  });
  it("toContent mapeia titulo→capa, passos→bullets e indicador→kpi", () => {
    const c = dicaLine.toContent(goodDica, { orgId: "o", orgName: "IMAGO", rag: "" });
    expect(c.cover.title).toBe(goodDica.titulo);
    expect(c.sections?.[0].bullets).toEqual(goodDica.passos);
    expect(c.kpis?.[0].value).toBe("3h/sem");
  });
  it("aceita geração realista (indicador com valor longo) — regressão do limite estrito", () => {
    const real = { ...goodDica, indicador: { label: "Tempo economizado por semana", value: "cerca de 3 horas por pessoa" } };
    expect(dicaSchema.safeParse(real).success).toBe(true);
  });
  it("indicador inválido degrada para undefined sem derrubar o documento (.catch)", () => {
    const r = dicaSchema.safeParse({ ...goodDica, indicador: { label: "x" } as unknown });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.indicador).toBeUndefined();
  });
});

describe("R3.2 · catálogo completo por família", () => {
  it("todas as 6 famílias têm ao menos uma linha registrada", () => {
    for (const f of FAMILIES) expect(linesInFamily(f.key).length).toBeGreaterThan(0);
  });
  it("cobre os tipos-chave do catálogo", () => {
    for (const k of ["relatorio", "apresentacao", "workshop", "curso", "email_mkt", "whatsapp", "arte", "video_roteiro"]) {
      expect(getLine(k), `linha ${k} registrada`).toBeTruthy();
    }
  });
  it("cada linha tem family, renderTarget e brandDefault válidos", () => {
    const fams = new Set(FAMILIES.map((f) => f.key));
    for (const l of allLines()) {
      expect(fams.has(l.family)).toBe(true);
      expect(["pdf", "pptx", "html", "docx"]).toContain(l.renderTarget);
      expect(["salestrack", "andre_kachan"]).toContain(l.brandDefault);
    }
  });
  it("linhas de mensagens marcam canal (elegível ao R4)", () => {
    for (const l of linesInFamily("mensagens")) expect(l.commChannel).toBeTruthy();
  });
});

describe("R3.3 · Família A rica + document renderer", () => {
  const ctx = { orgId: "o", orgName: "IMAGO", rag: "" };
  const rel = getLine("relatorio")!;
  const sample = { resumo_executivo: "Resumo do mês com avanços reais.", secoes: [{ titulo: "Andamento", corpo: "Tudo no plano." }], dados: [{ metrica: "Tempo economizado", valor: "12", legenda: "horas/semana" }, { metrica: "Adoção", valor: "80" }], conclusoes: "Os números sobem.", proximos_passos: ["Escalar"] };

  it("registra os 4 tipos ricos (relatorio/ebook/playbook_doc/proposta_doc)", () => {
    for (const k of ["relatorio", "ebook", "playbook_doc", "proposta_doc"]) expect(getLine(k), k).toBeTruthy();
  });
  it("relatório vira documento com bloco de dado (figura) + gráfico + sumário", () => {
    const c = rel.toContent(sample as never, ctx);
    expect(c.toc).toBe(true);
    const res = c.sections?.find((s) => s.figure);
    expect(res?.figure?.value).toBe("12");
    expect(res?.chart?.bars.length).toBe(2);
  });
  it("html renderiza os blocos ricos (figura/gráfico SVG/sumário)", () => {
    const html = buildDeliverableHtml({ kind: "relatorio_frente", brand_scope: "salestrack", format: "pdf", content: rel.toContent(sample as never, ctx), title: "Relatório" });
    expect(html).toContain("fig-v");
    expect(html).toContain("<svg");
    expect(html).toContain("Sumário");
    expect(html).toContain("Montserrat"); // sempre v2
  });
  it("proposta deixa explícito o modelo corrigido (oferta no AI OS, não plataforma)", () => {
    const c = getLine("proposta_doc")!.toContent({ oferta: "AI Sprint", contexto_cliente: "Contexto do cliente.", escopo: ["Diagnóstico"], valor: "R$ 50.000", termos: ["30 dias"] } as never, ctx);
    const joined = JSON.stringify(c);
    expect(joined).toContain("AI OS");
    expect(joined.toLowerCase()).toContain("não é plano");
  });
});

describe("R3.4 · Apresentações (motor de slides reutilizável)", () => {
  const ctx = { orgId: "o", orgName: "IMAGO", rag: "" };
  const sample = { titulo: "Programa de IA · IMAGO", slides: [
    { layout: "capa", title: "Programa de IA", eyebrow: "Apresentação", notas: "Cumprimente a equipe." },
    { layout: "estatistica", title: "Resultado", stat: { value: "12", label: "horas/semana economizadas" }, notas: "Enfatize o ganho." },
    { layout: "comparacao", title: "Antes x Depois", columns: [{ title: "Antes", bullets: ["Prompts soltos"] }, { title: "Depois", bullets: ["Playbook aplicado"] }] },
    { layout: "encerramento", title: "Vamos avançar", cta: "Próximo passo" },
  ] };

  it("biblioteca cobre os 8 layouts", () => {
    expect(Object.keys(LAYOUTS).length).toBe(8);
    for (const k of ["capa", "divisor", "conteudo", "estatistica", "citacao", "comparacao", "imagem", "encerramento"]) expect(SLIDE_LAYOUTS).toContain(k);
  });
  it("composeDeck mantém UMA capa e concatena as partes", () => {
    const deck = composeDeck("T", [[slideCapa("A")], [slideCapa("B"), slideConteudo("x")]]);
    expect(deck.slides.filter((s) => s.layout === "capa").length).toBe(1);
    expect(deck.slides.length).toBe(2);
    expect(deck.slides[0].layout).toBe("capa");
  });
  it("linha 'apresentacao' vira content.deck com notas do apresentador", () => {
    const c = apresentacaoLine.toContent(sample as never, ctx);
    expect(c.deck?.slides.length).toBe(4);
    expect(c.deck?.slides[0].notes).toContain("Cumprimente");
    expect(c.deck?.slides[1].stat?.value).toBe("12");
  });
  it("preview HTML do deck sai em v2 (slides + estatística lime + Montserrat)", () => {
    const html = buildDeliverableHtml({ kind: "apresentacao", brand_scope: "salestrack", format: "pptx", content: apresentacaoLine.toContent(sample as never, ctx), title: "Deck" });
    expect(html).toContain("l-capa");
    expect(html).toContain("s-stat");
    expect(html).toContain("Montserrat");
    expect(html).toContain("#EBF212"); // faísca lime na estatística
  });
});

describe("R3.5 · Formação (compõe A/B + testes + certificados)", () => {
  const ctx = { orgId: "o", orgName: "IMAGO", rag: "" };
  const curso = {
    objetivos: "Capacitar a equipe em IA aplicada.", publico: "Atendimento", carga_horaria: "8h",
    modulos: [{ titulo: "Fundamentos", objetivo: "Entender prompts", topicos: ["Contexto", "Objetivo"] }, { titulo: "Aplicação", objetivo: "Usar no dia a dia", topicos: ["Receitas"] }],
    teste: { nota_minima: 70, questoes: [{ enunciado: "O que é um bom prompt?", tipo: "multipla", alternativas: ["A", "B"], gabarito: 0 }, { enunciado: "IA substitui o time? (V/F)", tipo: "vf", gabarito: "F" }, { enunciado: "Descreva um caso.", tipo: "dissertativa" }] },
  };

  it("registra os 4 presets (palestra/workshop/treinamento/curso)", () => {
    for (const k of ["palestra", "workshop", "treinamento", "curso"]) expect(getLine(k), k).toBeTruthy();
  });
  it("curso vira documento com módulos + seção de avaliação + payload estruturado", () => {
    const c = getLine("curso")!.toContent(curso as never, ctx);
    expect(c.formacao?.tipo).toBe("curso");
    expect(c.formacao?.modulos.length).toBe(2);
    expect(c.sections?.some((s) => (s.title ?? "").toLowerCase().includes("teste"))).toBe(true);
  });
  it("corrigirTeste corrige as objetivas e decide aprovação", () => {
    const ok = corrigirTeste(curso.teste as never, [0, "F", "qualquer texto"]);
    expect(ok.objetivas).toBe(2); expect(ok.acertos).toBe(2); expect(ok.nota).toBe(100); expect(ok.aprovado).toBe(true); expect(ok.dissertativas).toBe(1);
    const bad = corrigirTeste(curso.teste as never, [1, "V", ""]);
    expect(bad.nota).toBe(0); expect(bad.aprovado).toBe(false);
  });
  it("composeFormacaoDeck reusa composeDeck (R3.4) com UMA capa + divisores de módulo", () => {
    const c = getLine("curso")!.toContent(curso as never, ctx);
    const deck = composeFormacaoDeck(c.formacao!, "IMAGO");
    expect(deck.slides.filter((s) => s.layout === "capa").length).toBe(1);
    expect(deck.slides.filter((s) => s.layout === "divisor").length).toBe(2);
  });
  it("certificado sai em v2 com participante + assinatura por atribuição", () => {
    const ak = buildCertificateHtml({ participante: "Ana Souza", formacao: "Curso de IA", data: "05/07/2026", attribution: "andre_kachan" });
    expect(ak).toContain("Ana Souza");
    expect(ak).toContain("André Kachan");
    expect(ak).toContain("Montserrat");
    const st = buildCertificateHtml({ participante: "Ana", formacao: "X", data: "05/07/2026", attribution: "salestrack" });
    expect(st).toContain("Salestrack AI");
  });
});

describe("R3.6 · Mensagens & Copy (regras por canal + merge fields + PII)", () => {
  const ctx = { orgId: "o", orgName: "IMAGO", rag: "" };

  it("registra os 4 canais", () => {
    for (const k of ["post", "mensagem", "whatsapp", "email_mkt"]) expect(getLine(k), k).toBeTruthy();
  });
  it("merge fields: extrai e valida variáveis; PII real é detectada", () => {
    expect(extractVars("Olá {{nome}}, da {{empresa}}!")).toEqual(["nome", "empresa"]);
    expect(validateMergeFields("Oi {{nome}}", ["nome"]).ok).toBe(true);
    expect(validateMergeFields("Oi {{nome}}", []).undeclared).toEqual(["nome"]);
    expect(detectPII("Fale com joao@ex.com ou 11 98888-7777").has).toBe(true);
    expect(detectPII("Olá {{nome}}, tudo bem?").has).toBe(false);
  });
  it("regras de canal: WhatsApp rejeita HTML e estoura limite", () => {
    expect(channelIssues("whatsapp", "<b>oi</b>").length).toBeGreaterThan(0);
    expect(channelIssues("whatsapp", "texto puro ok").length).toBe(0);
    expect(channelIssues("mensagem", "x".repeat(700)).length).toBeGreaterThan(0);
  });
  it("post vira content.message com variáveis derivadas; e-mail vira content.email", () => {
    const p = getLine("post")!.toContent({ plataforma: "LinkedIn", gancho: "Gancho {{nome}}", corpo: "Corpo do post.", hashtags: ["ia"], sugestao_visual: "card ink" } as never, ctx);
    expect(p.message?.canal).toBe("post");
    expect(p.message?.variaveis).toContain("nome");
    const e = getLine("email_mkt")!.toContent({ assunto: "Novidade", preheader: "abre aqui", corpo: ["Bloco 1"], cta: { label: "Ver" } } as never, ctx);
    expect(e.email?.assunto).toBe("Novidade");
  });
  it("e-mail HTML é MailerLite-ready (inline + descadastro); mensagem destaca {{var}}", () => {
    const html = buildEmailHtml({ assunto: "Oi", corpo: ["Olá {{nome}}"], cta: { label: "Ver" }, attribution: "salestrack" });
    expect(html).toContain("{{unsubscribe}}");
    expect(html).toContain("style=");
    expect(html).toContain("width:600px");
    const msg = buildMessageHtml({ canal: "whatsapp", texto: "Oi {{nome}}!", variaveis: ["nome"] });
    expect(msg).toContain("{{nome}}");
    expect(msg).toContain("WhatsApp");
  });
});

describe("R3.7 · Arte & Criativos (template v2 → PNG)", () => {
  const ctx = { orgId: "o", orgName: "IMAGO", rag: "" };

  it("registra arte + criativo_post; 6 templates e 4 tamanhos", () => {
    for (const k of ["arte", "criativo_post"]) expect(getLine(k), k).toBeTruthy();
    expect(Object.keys(CREATIVE_TEMPLATES).length).toBe(6);
    expect(Object.keys(CREATIVE_SIZES)).toEqual(["1:1", "4:5", "9:16", "16:9"]);
  });
  it("arte vira content.creative; carrossel expande em N slides", () => {
    const a = getLine("arte")!.toContent({ tipo_criativo: "numero", tamanho: "9:16", dado: { value: "12", label: "horas/sem" } } as never, ctx);
    expect(a.creative?.template).toBe("numero");
    expect(a.creative?.tamanho).toBe("9:16");
    const c = getLine("criativo_post")!.toContent({ tamanho: "1:1", slides: [{ headline: "A" }, { headline: "B" }, { headline: "C" }] } as never, ctx);
    expect(creativeSlides(c.creative!).length).toBe(3);
  });
  it("slide renderiza no tamanho do preset, em v2 (número em lime)", () => {
    const html = buildCreativeSlideHtml("numero", { dado: { value: "12", label: "horas/sem" } }, "1:1", { accent: "#4F1FFF" });
    expect(html).toContain("1080px");   // preset 1:1
    expect(html).toContain("Montserrat");
    expect(html).toContain("#EBF212");  // número em lime = prova
  });
  it("par com post: creativeFromPost gera criativo com postRef", () => {
    const c = creativeFromPost("Card ink com número grande", "9:16", "post-123", ctx);
    expect(c.creative?.template).toBe("anuncio");
    expect(c.creative?.postRef).toBe("post-123");
    expect(c.creative?.tamanho).toBe("9:16");
  });
});

describe("R3.8 · Vídeo (roteiro + storyboard; render graceful)", () => {
  const ctx = { orgId: "o", orgName: "IMAGO", rag: "" };
  const sample = {
    tipo: "explainer",
    roteiro: { narracao: ["Abrimos mostrando o antes.", "Fecho com o CTA."], textos_tela: ["Antes", "Depois"] },
    storyboard: [
      { visual: "Time olhando telas cheias", duracao: "0-5s", narracao: "O dia a dia sobrecarregado.", texto_tela: "Antes" },
      { visual: "Consultor IA resume", duracao: "5-20s", narracao: "A IA prioriza.", texto_tela: "Depois", arte: { dado: { value: "12", label: "h/sem" } } },
      { visual: "Logo + CTA", duracao: "20-30s", narracao: "Vamos avançar.", texto_tela: "Comece agora" },
    ],
    voiceover: "pt-BR feminino",
  };

  it("registra video_roteiro e vira content.video (roteiro + storyboard)", () => {
    const c = getLine("video_roteiro")!.toContent(sample as never, ctx);
    expect(c.video?.storyboard.length).toBe(3);
    expect(c.video?.roteiro.narracao.length).toBe(2);
    expect(c.video?.tipo).toBe("explainer");
  });
  it("storyboard renderiza em v2 com abertura/encerramento e dado lime", () => {
    const c = getLine("video_roteiro")!.toContent(sample as never, ctx);
    const html = buildStoryboardHtml(c.video!, { accent: "#4F1FFF" });
    expect(html).toContain("Montserrat");
    expect(html).toContain("Abertura");
    expect(html).toContain("Encerramento");
    expect(html).toContain("#EBF212"); // frame de dado (número como prova)
    expect(html).toContain("Narração");
  });
  it("render é graceful: sem credencial de ferramenta → null (storyboard é o entregável)", () => {
    expect(videoToolFor("explainer")).toBeNull();
    expect(videoToolFor("apresentador")).toBeNull();
  });
});

describe("R4.1 · Régua de comunicação (definição + gate)", () => {
  it("valida contratos de gatilho (tempo/evento/estado)", () => {
    expect(validarGatilho({ tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 3 }).ok).toBe(true);
    expect(validarGatilho({ tipo: "tempo", quando: "data_fixa" }).ok).toBe(false); // sem data
    expect(validarGatilho({ tipo: "evento", evento: "entregavel_aprovado" }).ok).toBe(true);
    expect(validarGatilho({ tipo: "evento", evento: "inexistente" }).ok).toBe(false);
    expect(validarGatilho({ tipo: "estado", condicao: "inatividade", dias_limite: 10 }).ok).toBe(true);
    expect(gatilhoLabel({ tipo: "evento", evento: "sessao_agendada" })).toContain("Sessão agendada");
  });
  it("GATE: passo sem ativo aprovado fica incompleto; com ativo aprovado+elegível fica completo", () => {
    const step = { cycle_step: 0, titulo: "x", gatilho: { tipo: "evento", evento: "entregavel_aprovado" } as never, asset_type: "whatsapp", asset_ref: "a1" };
    expect(stepCompleteness({ ...step, asset_ref: null }, undefined).status).toBe("incompleto");
    expect(stepCompleteness(step, { id: "a1", status: "rascunho", comm_eligible: false }).status).toBe("incompleto");
    expect(stepCompleteness(step, { id: "a1", status: "aprovado", comm_eligible: false }).status).toBe("incompleto"); // msg não elegível
    expect(stepCompleteness(step, { id: "a1", status: "aprovado", comm_eligible: true }).status).toBe("completo");
    // ativo não-mensagem (relatório) não exige comm_eligible
    expect(stepCompleteness({ ...step, asset_type: "relatorio" }, { id: "a1", status: "publicado", comm_eligible: false }).status).toBe("completo");
    expect(assetTypeIsMessage("whatsapp")).toBe(true);
    expect(assetTypeIsMessage("relatorio")).toBe(false);
  });
  it("instantiateSteps copia sem asset_ref e cobre o ciclo", () => {
    const copied = instantiateSteps(DEFAULT_REGUA_STEPS, "reg-1");
    expect(copied.every((s) => s.asset_ref === null && s.regua_id === "reg-1")).toBe(true);
    expect(new Set(DEFAULT_REGUA_STEPS.map((s) => s.cycle_step)).size).toBeGreaterThanOrEqual(4);
  });
});

describe("R4.3 · Orquestração (idempotência + avaliação de gatilho)", () => {
  it("idempotencyKey é determinística e muda por instância de ciclo (não duplica)", () => {
    const a = idempotencyKey("p1", "s1", "r1", 2);
    expect(idempotencyKey("p1", "s1", "r1", 2)).toBe(a); // mesma → mesma chave (unique bloqueia dup)
    expect(idempotencyKey("p1", "s1", "r1", 3)).not.toBe(a); // novo ciclo → nova chave
    expect(idempotencyKey("p1", "s1", "r2", 2)).not.toBe(a); // outro destinatário
  });
  it("isDue: evento casa pelo gancho; tempo casa pela fase; estado não pelo scheduler simples", () => {
    const stepEvento = { cycle_step: 1, gatilho: { tipo: "evento", evento: "entregavel_aprovado" } as never };
    expect(isDue(stepEvento, { cycle_step: 0 }, "entregavel_aprovado")).toBe(true);
    expect(isDue(stepEvento, { cycle_step: 0 }, "sessao_agendada")).toBe(false);
    const stepTempo = { cycle_step: 2, gatilho: { tipo: "tempo", quando: "apos_inicio_fase", offset_dias: 0 } as never };
    expect(isDue(stepTempo, { cycle_step: 2 })).toBe(true);
    expect(isDue(stepTempo, { cycle_step: 1 })).toBe(false);
    const stepEstado = { cycle_step: 3, gatilho: { tipo: "estado", condicao: "inatividade", dias_limite: 10 } as never };
    expect(isDue(stepEstado, { cycle_step: 3 })).toBe(false);
  });
});

describe("R4.2 · Canais — resolução de variáveis no envio (PII só aqui)", () => {
  it("resolve {{nome}}/{{empresa}} com o destinatário real (primeiro nome)", () => {
    const r = resolveVars("Olá {{nome}}, da {{empresa}}!", { nome: "Ana Souza", empresa: "IMAGO" });
    expect(r.resolved).toBe("Olá Ana, da IMAGO!");
    expect(r.missing).toEqual([]);
  });
  it("bloqueia variável faltante (não envia placeholder cru)", () => {
    const r = resolveVars("Oi {{nome}}", {});
    expect(r.missing).toEqual(["nome"]);
    expect(r.resolved).toContain("{{nome}}"); // mantém placeholder → caller bloqueia
    const a = resolveAsset(["{{nome}}", "{{empresa}}"], { nome: "Ana" });
    expect(a.ok).toBe(false);
    expect(a.missing).toContain("empresa");
  });
  it("resolveAsset ok quando todas presentes", () => {
    const a = resolveAsset(["Oi {{nome}}", "sua empresa {{empresa}}"], { nome: "Ana Souza", empresa: "IMAGO" });
    expect(a.ok).toBe(true);
    expect(a.resolved).toEqual(["Oi Ana", "sua empresa IMAGO"]);
  });
});

describe("R3.2 · design ÚNICO v2 (marca é só atribuição, nunca troca o design)", () => {
  const content = dicaLine.toContent(goodDica, { orgId: "o", orgName: "IMAGO", rag: "" });
  const st = buildDeliverableHtml({ kind: "one_pager", brand_scope: "salestrack", format: "pdf", content, title: goodDica.titulo });
  const ak = buildDeliverableHtml({ kind: "one_pager", brand_scope: "andre_kachan", format: "pdf", content, title: goodDica.titulo });

  it("AMBAS as marcas usam o design v2 (Montserrat + violeta), sem navy/gold/Cormorant", () => {
    for (const html of [st, ak]) {
      expect(html).toContain("Montserrat");
      expect(html).toContain("#8B5CFF");
      expect(html).not.toContain("Cormorant");
      expect(html).not.toContain("#C89B3C");
    }
  });
  it("a diferença entre marcas é só a assinatura (atribuição)", () => {
    expect(brandSignature("salestrack").footer).not.toBe(brandSignature("andre_kachan").footer);
    expect(ak).toContain("André Kachan"); // atribuição na assinatura
  });
  it("accent da identidade só entra se for da paleta v2", () => {
    expect(isV2Accent("#EBF212")).toBe(true);
    expect(isV2Accent("#C89B3C")).toBe(false); // gold do André Kachan é rejeitado
    const withGold = buildDeliverableHtml({ kind: "one_pager", brand_scope: "salestrack", format: "pdf", content, title: "x", accent: "#C89B3C" });
    expect(withGold).not.toContain("#C89B3C"); // ignorado → cai no violeta
    const withLime = buildDeliverableHtml({ kind: "one_pager", brand_scope: "salestrack", format: "pdf", content, title: "x", accent: "#4F1FFF" });
    expect(withLime).toContain("#4F1FFF");
  });
});
