import { describe, it, expect } from "vitest";
import { OPERACOES, OPERADORES, BASE_LEGAL_TEXTO, paisesForaDoBrasil } from "@/lib/lgpd/registro-conteudo";

/**
 * O registro do art. 37 é a fonte da política de privacidade PÚBLICA.
 *
 * Isso muda o que um teste aqui precisa fazer. Não é conferir tipos: é impedir que um campo vazio,
 * uma base legal inventada ou um país esquecido virem texto publicado — porque publicado, ele deixa
 * de ser um bug e passa a ser uma declaração falsa da empresa sobre o que faz com dado pessoal.
 */

// Exatamente o `tratamento_operacoes_base_check` da migration 071, transcrito à mão de propósito.
const BASES_NO_BANCO = [
  "consentimento", "execucao_contrato", "legitimo_interesse",
  "obrigacao_legal", "exercicio_direitos", "protecao_credito", "procedimento_preliminar",
];

describe("registro de operações de tratamento", () => {
  it("toda base legal usada é aceita pelo banco e tem tradução para o público", () => {
    for (const o of OPERACOES) {
      expect(BASES_NO_BANCO, `"${o.chave}" usa base "${o.baseLegal}", que o banco recusa`).toContain(o.baseLegal);
      expect(BASE_LEGAL_TEXTO[o.baseLegal], `"${o.baseLegal}" sairia cru na página pública`).toBeTruthy();
    }
  });

  it("nenhum campo obrigatório sai vazio na página pública", () => {
    for (const o of OPERACOES) {
      for (const campo of ["nome", "finalidade", "titulares", "dados", "origem", "retencao"] as const) {
        expect(o[campo]?.trim(), `"${o.chave}" está sem ${campo}`).toBeTruthy();
      }
    }
  });

  it("toda operação diz onde mora no sistema", () => {
    // É o que permite auditar a linha contra o código em vez de acreditar nela. Uma operação sem
    // endereço é uma afirmação sem como conferir — que é o defeito clássico de um ROPA de papel.
    for (const o of OPERACOES) {
      expect(o.ondeNoSistema?.trim(), `"${o.chave}" não diz onde está no sistema`).toBeTruthy();
    }
  });

  it("as chaves são únicas — chave repetida sobrescreve a linha anterior no upsert", () => {
    const chaves = OPERACOES.map((o) => o.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    const cOper = OPERADORES.map((o) => o.chave);
    expect(new Set(cOper).size).toBe(cOper.length);
  });

  it("todo operador declara país — é o que dispara o aviso de transferência internacional", () => {
    for (const o of OPERADORES) {
      expect(o.pais?.trim(), `operador "${o.chave}" sem país`).toBeTruthy();
      expect(o.papel?.trim(), `operador "${o.chave}" sem papel`).toBeTruthy();
      expect(o.dados?.trim(), `operador "${o.chave}" sem o que recebe`).toBeTruthy();
    }
  });

  it("o aviso de transferência internacional é derivado, e ignora operador desligado", () => {
    const paises = paisesForaDoBrasil();
    expect(paises.length, "nenhum país fora do Brasil — a lista deixou de ser derivada?").toBeGreaterThan(0);
    expect(paises.some((p) => /^Brasil/.test(p)), "Brasil entrou na lista de transferência internacional").toBe(false);

    // Docusign está desligado hoje (chaves pendentes). Se ele fosse contado, a página anunciaria um
    // destino para onde nenhum dado vai — o inverso do erro que se costuma temer, e igualmente falso.
    const soDesligado = paisesForaDoBrasil([
      { chave: "x", ordem: 1, nome: "X", papel: "p", dados: "d", pais: "Marte", inativo: true },
    ]);
    expect(soDesligado).toEqual([]);
  });

  /**
   * O defeito que este teste prende foi encontrado na verificação da primeira versão em produção.
   *
   * O texto da operação "clientes" dizia que o contrato é compartilhado com o Docusign. A tabela
   * de operadores dizia o contrário, porque o Docusign está desligado (chaves pendentes) e nenhum
   * contrato jamais passou por ele. As duas afirmações moram na MESMA página, uma embaixo da outra.
   *
   * Nomear um operador que não recebe nada é tão falso quanto omitir um que recebe — e é o tipo de
   * erro que entra por boa intenção, descrevendo o sistema que se pretende ter.
   */
  it("nenhuma operação cita operador que está desligado", () => {
    const desligados = OPERADORES.filter((o) => o.inativo);
    for (const op of OPERACOES) {
      const texto = `${op.compartilhamento ?? ""} ${op.observacao ?? ""}`;
      for (const d of desligados) {
        expect(
          texto.includes(d.nome.split(" ")[0]),
          `"${op.chave}" cita "${d.nome}", que está desligado — a tabela de operadores diria o contrário na mesma página`,
        ).toBe(false);
      }
    }
  });

  it("o banco de dados principal continua no Brasil", () => {
    // A afirmação está na página pública, em negrito. Se o Supabase mudasse de região e ninguém
    // atualizasse esta linha, a página passaria a mentir sobre onde os dados moram.
    const supabase = OPERADORES.find((o) => o.chave === "supabase");
    expect(supabase?.pais).toMatch(/^Brasil/);
  });
});
