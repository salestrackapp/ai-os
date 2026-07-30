import { NextResponse, type NextRequest } from "next/server";
import { rodarRegua, sincronizarComAsaas } from "@/lib/financeiro/cobranca";

/**
 * Régua de cobrança. Diário, pelo Vercel Cron.
 *
 * `?so_sincronizar=1` espelha o ASAAS sem mandar aviso nenhum — é o que se usa para conferir o
 * estado real antes de deixar a régua escrever para cliente. A primeira execução de uma régua de
 * cobrança é a que mais pode constranger: se o painel local estiver desatualizado, ela cobra quem
 * já pagou.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const key = url.searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (url.searchParams.get("so_sincronizar") === "1") {
    return NextResponse.json({ ok: true, sincronia: await sincronizarComAsaas() });
  }
  return NextResponse.json({ ok: true, regua: await rodarRegua() });
}
