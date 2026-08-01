import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { coletarFontesAtivas } from "@/lib/prospecting/coleta-linkedin";

/**
 * Coleta externa das fontes ativas. Diário, pelo Vercel Cron.
 *
 * Roda no máximo 3 fontes por vez, com pausa entre elas, e PARA no primeiro sinal de bloqueio em
 * vez de seguir para a próxima. Insistir contra um bloqueio é o caminho mais curto para a conta
 * cair de vez — e a conta em jogo é a pessoal do André.
 *
 * Se a coleta estiver desligada ou pausada, devolve o motivo em vez de rodar: o portão é o mesmo
 * de quando alguém clica "coletar agora", e não há caminho que o contorne.
 */
export async function GET(req: NextRequest) {
  return comRegistro("coleta", req, async () => {
  const resultado = await coletarFontesAtivas();
  return { resultado };
  });
}
