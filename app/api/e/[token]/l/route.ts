import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { registrarSinal } from "@/lib/prospecting/engajamento";

/**
 * Redirecionador com registro de clique.
 *
 * O destino vem DO BANCO, nunca da URL. Um `/r?u=https://…` transformaria o AI OS num
 * redirecionador aberto: qualquer pessoa poderia usar o nosso domínio para levar alguém a um site
 * de phishing, emprestando a nossa reputação de remetente. Com token opaco, só redirecionamos
 * para onde nós mesmos gravamos.
 *
 * Token desconhecido vai para a home em vez de dar 404: um link quebrado num e-mail que já saiu
 * não tem conserto, e mandar a pessoa para o site é melhor que uma página de erro.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const inicio = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://salestrack.com.br";
  try {
    const { token } = await params;
    const sb = createServiceClient();
    const { data: link } = await sb.from("engagement_links")
      .select("token, destino, rotulo, prospect_id, contact_id, message_id, cliques")
      .eq("token", token).maybeSingle();

    if (!link) return NextResponse.redirect(inicio, 302);

    // Clicar num link de agenda é intenção declarada, não curiosidade — pesa muito mais.
    await registrarSinal({
      tipo: link.rotulo === "agenda" ? "agenda_aberta" : "link_clicado",
      prospectId: link.prospect_id as string | null,
      contactId: link.contact_id as string | null,
      detalhe: { destino: link.destino, message_id: link.message_id },
      fonte: "link",
    });
    await sb.from("engagement_links")
      .update({ cliques: (link.cliques as number) + 1 }).eq("token", token);

    return NextResponse.redirect(link.destino as string, 302);
  } catch {
    return NextResponse.redirect(inicio, 302);
  }
}
