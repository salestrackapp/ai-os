import { NextResponse, type NextRequest } from "next/server";
import { inscrever, ORIGENS, type Origem } from "@/lib/marketing/inscricao";

/**
 * Inscrição vinda dos sites institucionais.
 *
 * ── Por que servidor-a-servidor, e não CORS ───────────────────────────────────────────────────
 * Os sites já falam com o AI OS assim para leads, com o mesmo `LEADS_WEBHOOK_SECRET`. Manter o
 * padrão evita abrir a rota ao navegador: um endpoint com CORS liberado para dois domínios ainda é
 * um endpoint que qualquer um chama de qualquer lugar — a origem no cabeçalho é escolhida por quem
 * chama, não verificada. O segredo, não.
 *
 * ── O que os sites mandam, e o que NÃO decidem ────────────────────────────────────────────────
 * Eles mandam o e-mail, o aceite, a origem e o IP de quem preencheu. Não mandam texto de aceite nem
 * status de consentimento: a redação do que a pessoa autorizou e o momento em que isso passa a
 * valer são decididos aqui, num lugar só. Se cada site pudesse declarar o próprio consentimento,
 * teríamos três versões da mesma obrigação legal — e a que divergisse seria a que autoriza a mais.
 *
 * Fail-closed, como toda rota de máquina do sistema.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.LEADS_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const enviado = req.headers.get("x-aios-secret") ?? "";
  if (enviado !== segredo) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const origem = String(body?.origem ?? "");

  const r = await inscrever({
    email: String(body?.email ?? ""),
    nome: body?.nome ? String(body.nome) : undefined,
    empresa: body?.empresa ? String(body.empresa) : undefined,
    aceite: body?.aceite === true,
    origem: (origem in ORIGENS ? origem : "inscricao_publica") as Origem,
    /**
     * O IP de quem PREENCHEU, repassado pelo site. Sem ele, o limite de taxa contaria todos os
     * visitantes daquele site num balde só — o servidor deles é um IP único — e bloquearia gente
     * legítima depois da quinta inscrição do dia. Confiável porque quem repassa provou o segredo.
     */
    ip: body?.ip ? String(body.ip) : null,
    userAgent: body?.userAgent ? String(body.userAgent) : null,
  });

  // 200 sempre que a chamada foi bem formada: o site mostra a mensagem, e o resultado do
  // consentimento não é assunto do canal de transporte.
  return NextResponse.json(r);
}
