import { NextResponse, type NextRequest } from "next/server";
import { resolvePortalOrg } from "@/lib/portal";
import { runConsultorTurn } from "@/lib/agents/channel";

/** Endpoint do Consultor do Programa (canal portal). Isolado por org; rate limit no núcleo. */
export async function POST(req: NextRequest) {
  const m = await resolvePortalOrg();
  if (!m || !m.orgId) return NextResponse.json({ error: "sem_contexto" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  const conversationId = body?.conversationId ? String(body.conversationId) : null;
  if (!message) return NextResponse.json({ error: "mensagem_vazia" }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: "mensagem_longa" }, { status: 400 });

  const r = await runConsultorTurn({ orgId: m.orgId, canal: "portal", text: message, userId: m.userId, conversationId });
  return NextResponse.json({ conversationId: r.conversationId, text: r.text, degraded: r.degraded }, { status: r.limited ? 429 : 200 });
}
