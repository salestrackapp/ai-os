import { describe, it, expect } from "vitest";
import { TIPOS_PEDIDO, ORDEM_TIPOS, ehTipoPedido, PRAZO_RESPOSTA_DIAS } from "@/lib/lgpd/tipos-pedido";
import { CAMINHO_DIREITOS, urlDireitos, EMAIL_ENCARREGADO } from "@/lib/lgpd/contato";
import { renderEmail, type Bloco } from "@/lib/marketing/blocos";

/**
 * O que estes testes prendem.
 *
 * Não a mecânica do formulário — isso o navegador prova. O que precisa de teste é a parte que falha
 * em silêncio: um tipo de pedido que a página oferece e o banco recusa (o titular preenche,
 * confirma, e o pedido não entra), e um rodapé de e-mail que perde a via de exercício de direito
 * porque alguém reescreveu o texto sem saber que ele era obrigação legal.
 */

// Exatamente o `dsr_tipo_check` de `dsr_requests`, transcrito à mão de propósito: se a migration
// mudar o conjunto sem alguém mexer aqui, o teste quebra — que é o aviso desejado.
const TIPOS_NO_BANCO = ["acesso", "exclusao", "portabilidade", "correcao", "oposicao", "revogacao"];

describe("vocabulário dos direitos do titular", () => {
  it("todo tipo oferecido na página é aceito por dsr_requests", () => {
    for (const tipo of Object.keys(TIPOS_PEDIDO)) {
      expect(TIPOS_NO_BANCO, `"${tipo}" aparece na página pública mas não existe em dsr_tipo_check — o pedido seria confirmado e recusado na gravação`)
        .toContain(tipo);
    }
  });

  it("nenhum tipo do banco fica sem porta de entrada pública", () => {
    for (const tipo of TIPOS_NO_BANCO) {
      expect(TIPOS_PEDIDO, `"${tipo}" é um direito que o banco registra e a página não oferece`)
        .toHaveProperty(tipo);
    }
  });

  it("a ordem exibida cobre todos os tipos, sem repetir", () => {
    expect([...ORDEM_TIPOS].sort()).toEqual(Object.keys(TIPOS_PEDIDO).sort());
    expect(new Set(ORDEM_TIPOS).size).toBe(ORDEM_TIPOS.length);
  });

  it("cada tipo tem os três textos que as telas usam", () => {
    for (const t of ORDEM_TIPOS) {
      expect(ehTipoPedido(t)).toBe(true);
      const { rotulo, curto, ajuda } = TIPOS_PEDIDO[t];
      // `rotulo` na tela, `curto` no e-mail de confirmação, `ajuda` embaixo da opção escolhida.
      for (const [nome, valor] of Object.entries({ rotulo, curto, ajuda })) {
        expect(valor?.trim(), `"${t}" está sem ${nome} — sairia um espaço vazio na tela ou no e-mail`).toBeTruthy();
      }
    }
  });

  it("rejeita o que não é tipo, incluindo o que só parece ser", () => {
    for (const v of ["", "acess", "ACESSO", "exclusão", null, undefined, 7, {}]) {
      expect(ehTipoPedido(v), `aceitou ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("o prazo é o da lei", () => {
    expect(PRAZO_RESPOSTA_DIAS).toBe(15);   // art. 19, II
  });
});

describe("a via de direitos nas superfícies públicas", () => {
  it("a URL é absoluta e aponta para o caminho da página", () => {
    const u = urlDireitos();
    expect(u, `precisa ser absoluta para funcionar dentro de e-mail: ${u}`).toMatch(/^https?:\/\//);
    expect(u.endsWith(CAMINHO_DIREITOS), `precisa terminar em ${CAMINHO_DIREITOS}: ${u}`).toBe(true);
    expect(u, `barra duplicada: ${u}`).not.toContain("//privacidade");
  });

  it("o rodapé da campanha carrega a via de direitos, com e sem link de descadastro", () => {
    const blocos: Bloco[] = [{ tipo: "texto", texto: "Oi." }];

    const comLink = renderEmail({ assunto: "A", blocos, unsubscribeUrl: "https://exemplo.com/x" });
    expect(comLink, "campanha com descadastro perdeu a via de direitos").toContain(urlDireitos());

    const semLink = renderEmail({ assunto: "A", blocos });
    expect(semLink, "campanha sem descadastro perdeu a via de direitos").toContain(urlDireitos());
    expect(semLink, "campanha sem descadastro perdeu o contato do encarregado").toContain(EMAIL_ENCARREGADO);
  });
});
