import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const SECTIONS = ["contexto", "investimento", "timeline", "plataforma", "condicoes"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const raw = await req.text();
  let body: { section?: string; seconds?: number } = {};
  try { body = JSON.parse(raw); } catch { /* ignore */ }
  const section = String(body.section ?? "");
  const seconds = Math.min(3600, Math.max(0, Math.round(Number(body.seconds) || 0)));
  if (!SECTIONS.includes(section) || seconds <= 0) return NextResponse.json({ ok: false });

  const sb = createServiceClient();
  const { data: prop } = await sb.from("proposals").select("id").eq("access_token", token).single();
  if (!prop) return NextResponse.json({ ok: false }, { status: 404 });
  await sb.from("proposal_events").insert({ proposal_id: prop.id, kind: "section_read", payload: { section, seconds } });
  return NextResponse.json({ ok: true });
}
