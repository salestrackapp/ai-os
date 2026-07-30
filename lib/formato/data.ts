/**
 * Formatação de data — e a armadilha que custou um bug visível.
 *
 * `new Date("2026-07-20")` é interpretado como meia-noite **UTC**. Em Brasília (UTC-3) isso é dia
 * 19 às 21h, e `toLocaleDateString("pt-BR")` mostra **19/07**. Quem cadastrou o prazo para 20/07
 * vê 19/07 na tela e conclui, com razão, que o sistema perdeu a data.
 *
 * Vale para toda coluna `date` do Postgres — prazo de entrega, vencimento de fatura, início e fim
 * de campanha. NÃO vale para `timestamptz`, que já carrega o instante correto.
 *
 * A distinção é feita pelo formato da string, não por configuração: dez caracteres é data pura, e
 * data pura é lida em UTC de propósito, porque foi assim que o banco a guardou.
 *
 * Sem `server-only`: as telas formatam no cliente.
 */

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** dd/mm/aaaa. Devolve "—" para vazio, nunca "Invalid Date" na cara do usuário. */
export function dataBR(valor: string | null | undefined): string {
  if (!valor) return "—";
  const s = String(valor);
  if (SO_DATA.test(s)) {
    // Lê e formata em UTC: o dia guardado é o dia mostrado, sem o fuso mexer nele.
    return new Date(s + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** dd/mm/aaaa hh:mm. Para timestamp; data pura cai no formato curto, que é o que ela é. */
export function dataHoraBR(valor: string | null | undefined): string {
  if (!valor) return "—";
  const s = String(valor);
  if (SO_DATA.test(s)) return dataBR(s);
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Dias entre hoje e uma data. Positivo = no futuro, negativo = passado.
 *
 * Compara em UTC os dois lados, senão o resultado muda conforme a hora do dia em que se pergunta —
 * e "vence em 1 dia" às 8h da manhã não pode virar "vence hoje" às 22h.
 */
export function diasAte(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const s = String(valor);
  const alvo = SO_DATA.test(s) ? new Date(s + "T00:00:00Z") : new Date(s);
  if (isNaN(alvo.getTime())) return null;

  const agora = new Date();
  const hojeUtc = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  const alvoUtc = Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate());
  return Math.round((alvoUtc - hojeUtc) / 86400000);
}

/** Dias de atraso, ou null quando não há. É a leitura que as telas de prazo realmente querem. */
export function diasDeAtraso(prazo: string | null | undefined, concluidoEm?: string | null): number | null {
  if (!prazo || concluidoEm) return null;
  const d = diasAte(prazo);
  return d !== null && d < 0 ? Math.abs(d) : null;
}
