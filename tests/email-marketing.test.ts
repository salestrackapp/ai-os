import { describe, it, expect } from "vitest";
import { renderEmail, renderTexto, resolverVariaveis, variaveisUsadas, blocoVazio, BLOCOS_DISPONIVEIS, type Bloco } from "@/lib/marketing/blocos";
import { TEMPLATES, templatePorSlug } from "@/lib/marketing/templates";
import { EMAIL_ENCARREGADO } from "@/lib/lgpd/contato";

/**
 * O renderizador é o mesmo no navegador (prévia) e no servidor (envio). Se ele quebrar, a prévia
 * passa a mentir — e ninguém descobre que a prévia mentia antes de o e-mail já estar na caixa de
 * milhares de pessoas. Daí a densidade de teste aqui ser maior do que o tamanho do módulo sugere.
 */

const BLOCOS: Bloco[] = [
  { tipo: "titulo", nivel: 1, texto: "Olá, {{nome}}" },
  { tipo: "texto", texto: "Tudo bem na {{empresa|sua empresa}}?" },
  { tipo: "lista", itens: ["Um", "Dois"] },
  { tipo: "botao", label: "Clique", url: "https://salestrack.com.br" },
];

describe("variáveis do destinatário", () => {
  it("troca pelo valor quando existe", () => {
    expect(resolverVariaveis("Olá, {{nome}}", { nome: "Ana" })).toBe("Olá, Ana");
  });

  /**
   * "Olá, {{nome}}!" chegando literalmente é o erro mais clássico de e-mail marketing — e é sempre
   * visível para quem recebe, nunca para quem enviou.
   */
  it("sem valor, usa o padrão depois do | — nunca deixa a chave crua", () => {
    expect(resolverVariaveis("Olá, {{nome|tudo bem}}?", {})).toBe("Olá, tudo bem?");
    expect(resolverVariaveis("Olá, {{nome|tudo bem}}?", { nome: "  " })).toBe("Olá, tudo bem?");
  });

  it("sem valor e sem padrão, some — some é melhor que aparecer errado", () => {
    expect(resolverVariaveis("Olá{{nome}}", {})).toBe("Olá");
  });

  it("tolera espaço dentro das chaves", () => {
    expect(resolverVariaveis("{{ nome | amigo }}", {})).toBe("amigo");
  });

  it("encontra as variáveis usadas, para a tela avisar sobre as desconhecidas", () => {
    expect(variaveisUsadas(BLOCOS).sort()).toEqual(["empresa", "nome"]);
  });
});

describe("HTML do e-mail", () => {
  const html = renderEmail({ assunto: "Assunto", blocos: BLOCOS, dados: { nome: "Ana", empresa: "Acme" }, unsubscribeUrl: "https://x/desc" });

  it("resolve as variáveis no corpo", () => {
    expect(html).toContain("Olá, Ana");
    expect(html).toContain("Acme");
    expect(html).not.toContain("{{");
  });

  /**
   * Outlook renderiza com o motor do Word: sem flexbox, sem grid, sem folha de estilo externa.
   * Tabela com estilo inline é o único denominador comum de Gmail a Outlook 2016.
   */
  it("é tabela com CSS inline, não layout moderno", () => {
    expect(html).toContain("<table");
    expect(html).toContain("style=");
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
    expect(html).not.toContain("<style");
  });

  it("escapa HTML do conteúdo — texto de campanha não pode virar marcação", () => {
    const h = renderEmail({ assunto: "x", blocos: [{ tipo: "texto", texto: "<script>alert(1)</script>" }] });
    expect(h).not.toContain("<script>alert");
    expect(h).toContain("&lt;script&gt;");
  });

  /** Obrigação legal: o rodapé é montado por código, nunca depende de alguém arrastar um bloco. */
  it("sempre traz via de saída — link quando há token, endereço quando não há", () => {
    expect(html).toContain("https://x/desc");
    expect(html).toContain("Descadastrar");
    const sem = renderEmail({ assunto: "x", blocos: [{ tipo: "texto", texto: "oi" }] });
    // Importa a constante: se o endereço do encarregado mudar, o teste acompanha em vez de quebrar.
    expect(sem).toContain(EMAIL_ENCARREGADO);
  });

  it("o preheader vai escondido, para não repetir na abertura da mensagem", () => {
    const h = renderEmail({ assunto: "A", preheader: "Segunda linha", blocos: [] });
    expect(h).toMatch(/display:none[^>]*>Segunda linha/);
  });

  it("bloco de imagem sem URL não gera <img> quebrado", () => {
    expect(renderEmail({ assunto: "x", blocos: [{ tipo: "imagem", url: "" }] })).not.toContain("<img");
  });
});

/**
 * A versão em texto vai junto no mesmo envio. Não é gentileza: e-mail só-HTML pontua pior nos
 * filtros de spam, e é dos ajustes mais baratos de entregabilidade.
 */
describe("versão em texto puro", () => {
  const txt = renderTexto({ assunto: "x", blocos: BLOCOS, dados: { nome: "Ana", empresa: "Acme" }, unsubscribeUrl: "https://x/desc" });

  it("tem o conteúdo, sem marcação", () => {
    expect(txt).toContain("OLÁ, ANA");
    expect(txt).toContain("- Um");
    expect(txt).not.toContain("<");
  });

  it("mostra o destino do botão — em texto, um rótulo sem URL não leva a lugar nenhum", () => {
    expect(txt).toContain("https://salestrack.com.br");
  });

  it("também traz a via de saída", () => {
    expect(txt).toContain("https://x/desc");
  });
});

describe("modelos prontos", () => {
  it("todos rendem HTML válido e sem variável crua", () => {
    for (const t of TEMPLATES) {
      const h = renderEmail({ assunto: t.assunto, preheader: t.preheader, blocos: t.blocos, dados: { nome: "Ana", empresa: "Acme" } });
      expect(h, t.slug).toContain("<table");
      expect(h, t.slug).not.toContain("{{");
    }
  });

  /**
   * Dois pedidos no mesmo e-mail rendem menos que um: quem lê precisa escolher antes de agir, e
   * escolher é mais caro do que clicar.
   */
  it("nenhum modelo tem mais de um botão", () => {
    for (const t of TEMPLATES) {
      expect(t.blocos.filter((b) => b.tipo === "botao").length, t.slug).toBeLessThanOrEqual(1);
    }
  });

  it("todo modelo tem assunto e conteúdo — nenhum devolve a folha em branco", () => {
    for (const t of TEMPLATES) {
      expect(t.assunto.trim(), t.slug).not.toBe("");
      expect(t.blocos.length, t.slug).toBeGreaterThan(1);
      expect(t.quando.length, t.slug).toBeGreaterThan(30);   // diz QUANDO usar, não só o nome
    }
  });

  it("os slugs são únicos e encontráveis", () => {
    const slugs = TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(templatePorSlug(s)?.slug).toBe(s);
  });
});

describe("catálogo de blocos", () => {
  it("todo tipo anunciado na tela tem um bloco vazio e renderiza", () => {
    for (const b of BLOCOS_DISPONIVEIS) {
      const vazio = blocoVazio(b.tipo);
      expect(vazio.tipo).toBe(b.tipo);
      expect(() => renderEmail({ assunto: "x", blocos: [vazio] })).not.toThrow();
    }
  });
});
