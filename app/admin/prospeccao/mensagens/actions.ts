"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { parsearCsvExportacao, ingerirMensagens } from "@/lib/prospecting/mensagens-linkedin";

async function exigirAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

/**
 * Recebe o conteúdo do `messages.csv` da exportação oficial do LinkedIn.
 *
 * O nome do André é pedido porque a exportação NÃO marca a direção da mensagem — ela só diz quem
 * é o remetente. Sem saber qual nome é o dele, não dá para distinguir o que ele mandou do que
 * recebeu, e a direção é justamente o que separa "essa pessoa me procurou" (sinal forte) de "eu
 * procurei essa pessoa" (nenhum sinal).
 */
export async function ingerirCsv(dados: { csv: string; meuNome: string }): Promise<string> {
  await exigirAdmin();
  if (!dados.meuNome.trim()) {
    throw new Error("Informe o nome que aparece nas suas mensagens — é o que diz quais você enviou e quais recebeu.");
  }
  if (!dados.csv.trim()) throw new Error("Cole o conteúdo do arquivo messages.csv.");

  const { linhas, ignoradas } = parsearCsvExportacao(dados.csv, dados.meuNome);
  if (linhas.length === 0) {
    throw new Error("Não reconheci nenhuma mensagem. Confira se o arquivo é o messages.csv da exportação do LinkedIn — ele precisa ter a coluna CONTENT.");
  }

  const r = await ingerirMensagens(linhas, "exportacao");
  revalidatePath("/admin/prospeccao/mensagens");

  const partes = [`${r.gravadas} mensagem(ns) guardada(s)`];
  if (r.sobreIa) partes.push(`${r.sobreIa} sobre IA`);
  if (r.casadas) partes.push(`${r.casadas} pessoa(s) da base ganhou(aram) sinal`);
  if (r.repetidas) partes.push(`${r.repetidas} já constava(m)`);
  if (ignoradas) partes.push(`${ignoradas} linha(s) sem conteúdo`);
  return partes.join(" · ") + ".";
}
