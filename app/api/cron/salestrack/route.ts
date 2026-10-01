import { NextResponse, type NextRequest } from "next/server";
import { saveDailyPlan } from "@/lib/salestrack-os/data";
import { createServiceClient } from "@/lib/supabase/service";
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.SALESTRACK_DAILY_ENABLED !== "true")
    return NextResponse.json({ ok: true, paused: true, sends: 0 });
  const started = new Date().toISOString();
  try {
    const result = await saveDailyPlan();
    const { error } = await createServiceClient()
      .from("cron_execucoes")
      .insert({
        nome: "salestrack",
        iniciado_em: started,
        duracao_ms: Date.now() - Date.parse(started),
        ok: true,
        resumo: result,
        erro: null,
      });
    if (error) throw Error("Falha ao registrar a execução.");
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Plano diário não confirmado; verificar banco e registro.",
      },
      { status: 503 },
    );
  }
}
