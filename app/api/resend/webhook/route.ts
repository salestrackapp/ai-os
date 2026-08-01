import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { suprimir } from "@/lib/marketing/audiencia";

/**
 * O que aconteceu com cada e-mail depois que saiu.
 *
 * O Resend assina com Svix. Sem `RESEND_WEBHOOK_SECRET` configurado a rota RECUSA — mesma regra de
 * toda rota de máquina aqui (ver `tests/rotas-fail-closed.test.ts`). Um webhook de métrica aberto
 * deixaria qualquer um marcar campanha como "aberta" ou, pior, suprimir endereços por conta própria.
 */

function assinaturaValida(raw: string, req: NextRequest, segredo: string): boolean {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;

  // Janela de 5 minutos: sem ela, uma requisição legítima capturada hoje vale para sempre.
  const idade = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(idade) || idade > 300) return false;

  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperado = crypto.createHmac("sha256", chave).update(`${id}.${ts}.${raw}`).digest("base64");
  // O cabeçalho traz uma lista ("v1,xxx v1,yyy") por causa da rotação de chave.
  return sig.split(" ").some((parte) => {
    const valor = parte.split(",")[1] ?? "";
    const a = Buffer.from(valor), b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/**
 * Cada evento vira um status e, às vezes, uma consequência.
 *
 * `bounced` e `complained` não são só métrica: são ordem de parar. Continuar mandando para uma caixa
 * que não existe, ou para quem denunciou como spam, é o caminho mais rápido para o domínio inteiro
 * cair na pasta de lixo eletrônico — inclusive os e-mails transacionais.
 */
const MAPA: Record<string, { status: string; campo?: "entregue_em" | "aberto_em" | "clicado_em"; suprime?: "bounce_duro" | "reclamacao" }> = {
  "email.delivered": { status: "entregue", campo: "entregue_em" },
  "email.opened": { status: "aberto", campo: "aberto_em" },
  "email.clicked": { status: "clicado", campo: "clicado_em" },
  "email.bounced": { status: "bounce", suprime: "bounce_duro" },
  "email.complained": { status: "reclamado", suprime: "reclamacao" },
  "email.delivery_delayed": { status: "enviado" },
};

export async function POST(req: NextRequest) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const raw = await req.text();
  if (!assinaturaValida(raw, req, segredo)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const evento = JSON.parse(raw || "{}") as { type?: string; data?: { email_id?: string; to?: string[] } };
  const regra = MAPA[String(evento.type ?? "")];
  if (!regra) return NextResponse.json({ ok: true, ignorado: evento.type });

  const sb = createServiceClient();
  const providerRef = evento.data?.email_id ?? null;
  const destino = (evento.data?.to ?? [])[0]?.toLowerCase() ?? null;

  const { data: envio } = providerRef
    ? await sb.from("email_envios").select("id, campanha_id, email, status").eq("provider_ref", providerRef).maybeSingle()
    : { data: null };

  if (envio) {
    /**
     * O status só avança. Um "entregue" que chega atrasado, depois do "clicado", não pode rebaixar
     * o registro — provedores entregam eventos fora de ordem com frequência.
     */
    const ORDEM = ["pendente", "enviado", "entregue", "aberto", "clicado"];
    const atual = ORDEM.indexOf(envio.status as string);
    const novo = ORDEM.indexOf(regra.status);
    const patch: Record<string, unknown> = {};
    if (novo === -1 || novo > atual) patch.status = regra.status;
    if (regra.campo) patch[regra.campo] = new Date().toISOString();
    if (Object.keys(patch).length) await sb.from("email_envios").update(patch).eq("id", envio.id);
  }

  if (regra.suprime) {
    const alvo = envio?.email ?? destino;
    if (alvo) await suprimir(alvo, regra.suprime, `Resend: ${evento.type}`, envio?.campanha_id ?? null);
  }

  return NextResponse.json({ ok: true });
}
