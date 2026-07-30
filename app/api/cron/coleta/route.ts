import { NextResponse, type NextRequest } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultado = await coletarFontesAtivas();
  return NextResponse.json({ ok: true, resultado });
}
