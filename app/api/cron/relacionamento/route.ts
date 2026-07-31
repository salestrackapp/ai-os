import { NextResponse, type NextRequest } from "next/server";
import { syncGmailInbox } from "@/lib/relacionamento/sync-email";
import { reconcileWhatsAppInbound } from "@/lib/relacionamento/sync-whatsapp";
import { triarPendentes } from "@/lib/relacionamento/triagem";
import { gerarSugestoesPendentes } from "@/lib/relacionamento/sugestao";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincroniza a caixa da Salestrack (Gmail → inbox de equipe) em background. WhatsApp é push (webhook).
 *
 * Depois de sincronizar, tria o que chegou e prepara rascunho só para o que precisa de pessoa. A
 * ordem é obrigatória: rascunhar antes de triar seria escrever resposta para newsletter.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const email = await syncGmailInbox(40);
  const whatsapp = await reconcileWhatsAppInbound(80);
  const triagem = await triarPendentes(30);
  const sugestoes = await gerarSugestoesPendentes(5);
  return NextResponse.json({ ok: true, email, whatsapp, triagem, sugestoes });
}
