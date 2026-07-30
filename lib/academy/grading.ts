import { corrigirTeste, type Teste } from "@/lib/studio/formacao/teste";

/**
 * Correção da prova da Academy.
 *
 * NÃO reimplementa a correção: adapta as linhas do banco para o formato de `corrigirTeste()`,
 * que já é o corretor do Estúdio e está documentado como "gancho de correção para o portal".
 * Uma implementação de correção no sistema inteiro — inclusive a guarda herdada de que
 * `aprovado` é falso quando não há questão objetiva nenhuma (prova vazia não aprova ninguém).
 */

export type QuestaoBanco = { id: string; ordem: number; tipo: string; enunciado: string };
export type GabaritoBanco = { question_id: string; gabarito: string };

/**
 * Monta o `Teste` a partir das linhas e corrige.
 * As respostas chegam por id de questão (não por índice) porque a ordem no banco pode mudar
 * entre a abertura e o envio da prova — ancorar em índice era o defeito da fonte antiga.
 */
export function corrigirProva(
  questoes: QuestaoBanco[],
  gabaritos: GabaritoBanco[],
  respostas: Record<string, string | null>,
  notaMinima: number,
) {
  const porId = new Map(gabaritos.map((g) => [g.question_id, g.gabarito]));
  const ordenadas = [...questoes].sort((a, b) => a.ordem - b.ordem);

  const teste: Teste = {
    nota_minima: notaMinima,
    questoes: ordenadas.map((q) => {
      const bruto = porId.get(q.id);
      return {
        enunciado: q.enunciado,
        // sem gabarito cadastrado, corrigirTeste() conta como dissertativa e a questão
        // sai do denominador — a pessoa não é punida por falha de cadastro.
        tipo: (q.tipo === "vf" ? "vf" : "multipla") as "vf" | "multipla",
        gabarito: bruto == null ? undefined : q.tipo === "vf" ? bruto : Number(bruto),
      };
    }),
  };

  const emOrdem = ordenadas.map((q) => respostas[q.id] ?? null);
  return corrigirTeste(teste, emOrdem);
}

/**
 * Código público do certificado: curto, digitável e sem caracteres ambíguos.
 * É o segredo da rota de verificação, mesmo padrão dos outros /[token] da casa.
 */
export function gerarCodigoCertificado(bytes: Uint8Array): string {
  const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const s = Array.from(bytes.slice(0, 12)).map((b) => AB[b % AB.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
