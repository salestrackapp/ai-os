import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// Schema (campos/seções) é dado puro — vive em lib/diagnostico-schema.ts (sem "server-only")
// para poder ser importado pelo formulário público, que é Client Component.
export type { CampoTipo, Campo, Secao } from "./diagnostico-schema";
export { DIAGNOSTICO_SECOES, DIAGNOSTICO_CAMPOS } from "./diagnostico-schema";

export type Intake = { id: string; org_id: string; token: string; titulo: string; status: "aberto" | "enviado"; dados: Record<string, string>; submitted_at: string | null };

/** Público (via token): carrega o intake. Token é o segredo; usa service client. */
export async function getIntakeByToken(token: string): Promise<Intake | null> {
  const { data } = await createServiceClient().from("diagnostico_intake").select("*").eq("token", token).maybeSingle();
  return (data as Intake | null) ?? null;
}

/** Público: salva o preenchimento (merge). `enviar` marca como enviado. */
export async function saveIntakeByToken(token: string, dados: Record<string, string>, enviar: boolean): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { data: cur } = await sb.from("diagnostico_intake").select("id, dados").eq("token", token).maybeSingle();
  if (!cur) return { ok: false };
  const merged = { ...(cur.dados ?? {}), ...dados };
  await sb.from("diagnostico_intake").update({
    dados: merged, updated_at: new Date().toISOString(),
    ...(enviar ? { status: "enviado", submitted_at: new Date().toISOString() } : {}),
  }).eq("id", cur.id);
  return { ok: true };
}

/** Admin: intake do cliente (cria se não existir). Gera o link público. */
export async function getOrCreateIntakeForOrg(orgId: string, titulo = "Diagnóstico Digital"): Promise<Intake> {
  const sb = createServiceClient();
  const { data } = await sb.from("diagnostico_intake").select("*").eq("org_id", orgId).maybeSingle();
  if (data) return data as Intake;
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.round(Math.random() * 1e9)}`).replace(/-/g, "");
  const { data: ins } = await sb.from("diagnostico_intake").insert({ org_id: orgId, token, titulo }).select("*").single();
  return ins as Intake;
}
