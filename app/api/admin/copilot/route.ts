import { NextResponse, type NextRequest } from "next/server";
import { currentMembership } from "@/lib/auth";
import { runCopilot } from "@/lib/agents/copilot";

/** Copiloto interno (admin Salestrack). Recebe {task, context} e devolve o texto gerado. */
export async function POST(req: NextRequest) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const task = String(body?.task ?? "").trim();
  const context = String(body?.context ?? "").slice(0, 12000);
  if (!task) return NextResponse.json({ error: "task_vazia" }, { status: 400 });
  const r = await runCopilot({ task, context });
  return NextResponse.json({ text: r.text, degraded: r.degraded });
}
