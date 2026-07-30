import { NextResponse, type NextRequest } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultado = await executarBuscasAtivas();
  return NextResponse.json({ ok: true, resultado });
}
