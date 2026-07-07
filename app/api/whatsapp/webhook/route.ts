import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runConsultorTurn } from "@/lib/agents/channel";
import { sendToContact } from "@/lib/whatsapp";
import { ingestWhatsAppInbound } from "@/lib/relacionamento/sync-whatsapp";

/** Extrai uma referência de mídia do payload Z-API, se houver (imagem/áudio/vídeo/documento). */
function extractMedia(body: Record<string, unknown>): { tipo: string; url?: string | null } | null {
  const pick = (o: unknown) => (o && typeof o === "object" ? (o as { url?: string; imageUrl?: string; documentUrl?: string }) : null);
  if (body.image) return { tipo: "imagem", url: pick(body.image)?.imageUrl ?? pick(body.image)?.url ?? null };
  if (body.audio) return { tipo: "áudio", url: pick(body.audio)?.url ?? null };
  if (body.video) return { tipo: "vídeo", url: pick(body.video)?.url ?? null };
  if (body.document) return { tipo: "documento", url: pick(body.document)?.documentUrl ?? pick(body.document)?.url ?? null };
  if (body.sticker) return { tipo: "figurinha", url: null };
  return null;
}

const STATUS_MAP: Record<string, string> = {
  sent: "enviado", received: "entregue", delivered: "entregue", read: "lido",
  played: "lido", error: "erro", failed: "erro",
};

export async function POST(req: NextRequest) {
  // segredo simples via query
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.WHATSAPP_WEBHOOK_KEY || key !== process.env.WHATSAPP_WEBHOOK_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = createServiceClient();
  const body = await req.json().catch(() => ({}));

  const providerRef = body?.messageId ?? body?.id ?? body?.zaapId ?? null;
  const rawStatus = String(body?.status ?? "").toLowerCase();

  // 1) Atualização de status de entrega
  if (providerRef && rawStatus) {
    const mapped = STATUS_MAP[rawStatus] ?? "enviado";
    await sb.from("wa_messages").update({ status: mapped }).eq("provider_ref", providerRef);
  }

  // 2) Mensagem recebida (inbound)
  const isInbound = body?.type === "ReceivedCallback" || body?.fromMe === false || (!!body?.text && !rawStatus);
  const text = body?.text?.message ?? body?.message ?? body?.body ?? null;
  const fromPhone = body?.phone ?? body?.from ?? null;
  if (isInbound && (text || fromPhone)) {
    const { data: msg } = await sb.from("wa_messages").insert({
      direction: "in", provider: "zapi", from_phone: fromPhone, body: text,
      status: "entregue", provider_ref: providerRef,
    }).select("id").single();
    // tenta associar a um contato/org pelo telefone
    const digits = String(fromPhone ?? "").replace(/\D/g, "");
    let orgId: string | null = null;
    let optIn = false;
    if (digits) {
      const { data: c } = await sb.from("contacts").select("org_id, opt_in_whatsapp, phone").ilike("phone", `%${digits.slice(-8)}%`).limit(1).single();
      orgId = c?.org_id ?? null;
      optIn = !!c?.opt_in_whatsapp;
    }
    await sb.from("activities").insert({
      org_id: orgId, kind: "whatsapp", ref_table: "wa_messages", ref_id: msg?.id ?? null,
      payload: { direction: "in", from: fromPhone, text },
    });

    // E3: ingesta na inbox de EQUIPE (rel_conversas/rel_mensagens, channel=whatsapp). Nunca quebra o webhook.
    try {
      await ingestWhatsAppInbound({
        phone: String(fromPhone ?? ""), name: body?.senderName ?? body?.chatName ?? null,
        text: text ? String(text) : null, providerRef, media: extractMedia(body ?? {}),
        at: body?.momment ? new Date(Number(body.momment)).toISOString() : null,
      });
    } catch { /* inbox de equipe é aditiva; não derruba o consultor/webhook */ }

    // Consultor do Programa via WhatsApp: só contato identificado de uma org E com opt-in.
    // Mesma memória/histórico da org (continuidade com o portal). Degrada sem ANTHROPIC/Z-API sem quebrar.
    if (text && orgId && optIn) {
      try {
        const turn = await runConsultorTurn({ orgId, canal: "whatsapp", text: String(text) });
        await sendToContact({ phone: fromPhone, optIn: true, body: turn.text, orgId });
      } catch { /* nunca quebra o webhook */ }
    }
  }

  return NextResponse.json({ ok: true });
}

// Z-API às vezes faz GET de verificação
export async function GET() { return NextResponse.json({ ok: true }); }
