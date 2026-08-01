import { type NextRequest } from "next/server";
import { comRegistro } from "@/lib/ops/cron";
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
  return comRegistro("relacionamento", req, async () => {
  const email = await syncGmailInbox(40);
  const whatsapp = await reconcileWhatsAppInbound(80);
  const triagem = await triarPendentes(30);
  const sugestoes = await gerarSugestoesPendentes(5);
  return { email, whatsapp, triagem, sugestoes };
  });
}
