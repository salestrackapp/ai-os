import { NextResponse, type NextRequest } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultado = await aplicarRetencao();
  return NextResponse.json({ ok: true, resultado });
}
