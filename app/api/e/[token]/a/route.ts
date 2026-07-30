import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { registrarSinal } from "@/lib/prospecting/engajamento";

/**
 * Pixel de abertura. Sempre devolve o GIF, aconteça o que acontecer com o registro do sinal.
 *
 * Um pixel que erra e devolve 500 vira um ícone de imagem quebrada dentro do e-mail que acabamos
 * de mandar para um prospect. O sinal é enriquecimento; a aparência da mensagem, não.
 *
 * Rota anônima: quem abre o e-mail não tem sessão. Service client, igualdade contra o token — o
 * mesmo padrão de /p/[token] e /entregavel/[token].
 */

// GIF transparente de 1×1, o menor que existe.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function responder() {
  return new NextResponse(GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(GIF.length),
      // Sem cache: um proxy guardando o pixel esconderia todas as aberturas seguintes.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const sb = createServiceClient();
    const { data: link } = await sb.from("engagement_links")
      .select("token, prospect_id, contact_id, message_id, cliques").eq("token", token).maybeSingle();

    if (link) {
      /**
       * Só a PRIMEIRA abertura conta. Cliente de e-mail recarrega imagem toda vez que a mensagem
       * é reaberta, e firewall corporativo faz pré-fetch — contar cada carregamento inflaria o
       * score de quem só tem um antivírus zeloso.
       */
      if ((link.cliques as number) === 0) {
        await registrarSinal({
          tipo: "email_aberto",
          prospectId: link.prospect_id as string | null,
          contactId: link.contact_id as string | null,
          detalhe: { message_id: link.message_id },
          fonte: "pixel",
        });
        await sb.from("engagement_links").update({ cliques: 1 }).eq("token", token);
      }
    }
  } catch {
    // Silêncio proposital: o pixel nunca pode falhar visivelmente dentro do e-mail.
  }
  return responder();
}
