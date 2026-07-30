import { NextResponse, type NextRequest } from "next/server";
import { avisarLead, type TabelaLead } from "@/lib/leads/avisar";

export const dynamic = "force-dynamic";

/**
 * Chamada pelos dois sites imediatamente depois de gravar um lead.
 *
 * Fecha o buraco: os sites são projetos separados e não devem alcançar o dispatcher de
 * notificações nem o Resend do AI OS. Eles só dizem "chegou o lead X na tabela Y"; quem
 * decide o que fazer é o AI OS.
 *
 * Fail-closed: sem LEADS_WEBHOOK_SECRET configurado a rota devolve 503, não passa livre.
 * Foi o defeito que `/api/cron/orchestrate` tinha (guarda `if (secret && ...)` — fail-OPEN)
 * e que consertamos na Fase 1; não repetir aqui.
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.LEADS_WEBHOOK_SECRET;
  if (!esperado) {
    console.error("[leads] LEADS_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tabela = String(body?.tabela ?? "");
  const leadId = String(body?.leadId ?? "");

  if (!["site_leads", "andrekachan_leads"].includes(tabela)) {
    return NextResponse.json({ error: "tabela inválida" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return NextResponse.json({ error: "leadId inválido" }, { status: 400 });
  }

  const avisou = await avisarLead(tabela as TabelaLead, leadId);
  // `avisou: false` não é erro — é lead já avisado (idempotência) ou inexistente
  return NextResponse.json({ ok: true, avisou });
}
