import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
import { aplicarRetencao } from "@/lib/lgpd/retencao";

/**
 * Descarte por prazo na base de prospecção. Diário, pelo Vercel Cron
 * (Authorization: Bearer CRON_SECRET) ou manualmente com ?key=CRON_SECRET.
 * Sem CRON_SECRET definido, recusa — nunca fica aberto.
 *
 * Este cron é parte da conformidade, não uma faxina de conveniência: o legítimo interesse que
 * sustenta a prospecção depende de o dado não ser guardado além da finalidade (art. 15, I). Se
 * ele parar de rodar, a base envelhece e a base legal enfraquece junto — por isso a resposta traz
 * a contagem, para dar para conferir que rodou.
 */
export async function GET(req: NextRequest) {
  return comRegistro("retencao", req, async () => {
  const resultado = await aplicarRetencao();
  return { resultado };
  });
}
