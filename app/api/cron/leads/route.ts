import { NextResponse, type NextRequest } from "next/server";
import { avisarPendentes } from "@/lib/leads/avisar";

/**
 * Rede de segurança do aviso de lead. Chamado pelo Vercel Cron
 * (Authorization: Bearer CRON_SECRET) ou manualmente com ?key=CRON_SECRET.
 * Sem CRON_SECRET definido, recusa — nunca fica aberto.
 *
 * O caminho normal é o site chamar /api/leads/novo na hora da gravação — imediato. Esta
 * varredura existe para quando aquela chamada falha (rede, deploy em andamento, segredo
 * trocado): o lead está salvo, mas ninguém foi avisado. `notificado_em` é o que impede reenvio.
 *
 * LIMITAÇÃO: a conta Vercel é Hobby, que só permite cron DIÁRIO. Então um lead cuja chamada
 * imediata falhe pode esperar até 24h pelo aviso. Enquanto a conta for Hobby, este cron é uma
 * rede de segurança de último recurso, não um substituto do caminho imediato. Se a captação
 * ganhar volume, vale rodar de hora em hora — o que exige o plano Pro.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultado = await avisarPendentes();
  return NextResponse.json({ ok: true, resultado });
}
