import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { executarBuscasAtivas } from "@/lib/prospecting/coleta";

/**
 * Coleta automatizada de prospects pelo Apollo. Diário, pelo Vercel Cron
 * (Authorization: Bearer CRON_SECRET) ou manualmente com ?key=CRON_SECRET.
 * Sem CRON_SECRET definido, recusa — nunca fica aberto.
 *
 * A resposta traz a contagem de cada busca porque este cron GASTA DINHEIRO: cada enriquecimento
 * consome crédito do Apollo. Um cron caro que roda em silêncio é um cron que ninguém percebe
 * quando começa a queimar créditos à toa.
 *
 * O teto por execução vive em cada busca (`teto_enriquecimento`), não aqui: buscas diferentes
 * merecem orçamentos diferentes.
 */
export async function GET(req: NextRequest) {
  return comRegistro("prospeccao", req, async () => {
  const resultado = await executarBuscasAtivas();
  return { resultado };
  });
}
