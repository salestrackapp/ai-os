import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revogarMarketing, registrarOposicao } from "@/lib/lgpd/consentimento";

/**
 * Descadastro em um clique, pelo botão nativo do provedor de e-mail.
 *
 * ── Por que existe além da página ─────────────────────────────────────────────────────────────
 * O cabeçalho `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) faz Gmail e Outlook
 * mostrarem "cancelar inscrição" no topo da mensagem. É o botão que a pessoa acha primeiro — e cada
 * uso dele é uma denúncia de spam que NÃO aconteceu. Reclamação de spam derruba a reputação do
 * domínio inteiro, inclusive dos e-mails transacionais que nada têm a ver com a campanha.
 *
 * Mas o provedor exige POST. A página `/descadastro/[token]` responde a GET; anunciar o cabeçalho
 * sem aceitar POST é pior do que não anunciar, porque o provedor registra a falha contra o domínio.
 *
 * ── Sem segredo, e é assim mesmo ──────────────────────────────────────────────────────────────
 * A rota não pede autenticação: o token na URL É a credencial, e quem o tem recebeu o e-mail. Ao
 * contrário dos webhooks, aqui não há segredo para fail-closed proteger — e o pior que alguém
 * consegue fazendo POST com um token válido é descadastrar quem já podia se descadastrar.
 */
async function descadastrar(token: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data: t } = await sb.from("descadastro_tokens")
    .select("token, canal, endereco").eq("token", token).maybeSingle();
  if (!t) return false;

  const endereco = t.endereco as string;
  const { count } = await sb.from("prospects")
    .select("id", { count: "exact", head: true }).ilike("email", endereco);

  await revogarMarketing(endereco, t.canal as "email" | "whatsapp");
  if ((count ?? 0) > 0) await registrarOposicao(endereco);
  await sb.from("descadastro_tokens").update({ usado_em: new Date().toISOString() }).eq("token", token);
  return true;
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await descadastrar(token);
  // 200 mesmo com token desconhecido: o provedor só quer saber que a requisição foi aceita, e
  // responder 404 revelaria quais tokens existem para quem quisesse sondar.
  return NextResponse.json({ ok });
}

/**
 * GET redireciona para a página, que confirma visualmente o que aconteceu.
 *
 * Alguns clientes de e-mail seguem o `List-Unsubscribe` com GET quando não suportam One-Click — o
 * link precisa funcionar dos dois jeitos, e nunca terminar numa resposta JSON crua na cara de quem
 * clicou.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/descadastro/${token}`, req.url), 302);
}
