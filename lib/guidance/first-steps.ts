import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Passos do "Primeiros passos" — deriva do estado real quando possível; senão marca ao visitar. */
type Step = { key: string; label: string; href: string };
export type GuideStep = Step & { done: boolean };
export type Guide = { steps: GuideStep[]; pct: number; dismissed: boolean };

export const DISMISS_KEY = "dismissed:primeiros-passos";

// Caminho de ouro do admin, ponta a ponta (R5.1): do primeiro cliente à régua conduzindo sozinha.
const ADMIN_STEPS: Step[] = [
  { key: "conhecer-hoje", label: "Conhecer o cockpit Hoje", href: "/admin/hoje" },
  { key: "cadastrar-cliente", label: "Cadastrar seu primeiro cliente", href: "/admin/onboarding/novo" },
  { key: "primeira-proposta", label: "Criar e enviar sua primeira proposta", href: "/admin/propostas" },
  { key: "abrir-ficha-cliente", label: "Abrir a ficha de um cliente", href: "/admin/programas" },
  { key: "produzir-entregavel", label: "Produzir um entregável no Estúdio (gerar → aprovar)", href: "/admin/entregaveis" },
  { key: "ativar-regua", label: "Deixar a régua conduzir o cliente", href: "/admin/comunicacao" },
];
const PORTAL_STEPS: Step[] = [
  { key: "entender-jornada", label: "Entender a sua Jornada", href: "/portal" },
  { key: "ver-etapa-atual", label: "Ver a etapa atual do método", href: "/portal" },
  { key: "conhecer-copilotos", label: "Conhecer os Copilotos", href: "/portal/copilotos" },
  { key: "conhecer-automacoes", label: "Ver suas Automações (stack + sessões)", href: "/portal/automacoes" },
  { key: "ver-visao-geral", label: "Ver a Visão geral e os resultados", href: "/portal/visao" },
];

/** Calcula o guia do usuário. `autoVisitKey` marca (uma vez) o passo da tela atual ao renderizar. */
export async function computeGuide(surface: "admin" | "portal", orgId: string, userId: string, autoVisitKey?: string): Promise<Guide> {
  const sb = await createClient();
  // RLS já restringe ao próprio usuário (user_id = auth.uid()).
  const { data: rows } = await sb.from("onboarding_progress").select("key, done_at").eq("surface", surface);
  const doneKeys = new Set((rows ?? []).filter((r) => r.done_at).map((r) => r.key));
  const dismissed = (rows ?? []).some((r) => r.key === DISMISS_KEY);

  if (autoVisitKey && !doneKeys.has(autoVisitKey)) {
    try {
      await createServiceClient().from("onboarding_progress").upsert(
        { org_id: orgId, user_id: userId, surface, key: autoVisitKey, done_at: new Date().toISOString() },
        { onConflict: "user_id,surface,key" },
      );
      doneKeys.add(autoVisitKey);
    } catch { /* não bloquear a página por causa do guia */ }
  }

  const derived = new Set<string>();
  try {
    if (surface === "admin") {
      const { count: orgs } = await sb.from("organizations").select("id", { count: "exact", head: true }).eq("is_salestrack", false);
      if ((orgs ?? 0) > 0) derived.add("cadastrar-cliente");
      const { count: props } = await sb.from("proposals").select("id", { count: "exact", head: true }).neq("status", "rascunho");
      if ((props ?? 0) > 0) derived.add("primeira-proposta");
      // R5.1 · produto inteiro: produzir um entregável aprovado + ativar a régua marcam sozinhos.
      const { count: dels } = await sb.from("studio_deliverables").select("id", { count: "exact", head: true }).in("status", ["aprovado", "publicado", "entregue"]).is("deleted_at", null);
      if ((dels ?? 0) > 0) derived.add("produzir-entregavel");
      const { count: reg } = await sb.from("regua").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if ((reg ?? 0) > 0) derived.add("ativar-regua");
    } else {
      const { count: proj } = await sb.from("projects").select("id", { count: "exact", head: true }).eq("org_id", orgId);
      if ((proj ?? 0) > 0) derived.add("ver-etapa-atual");
    }
  } catch { /* degradação graciosa */ }

  const defs = surface === "admin" ? ADMIN_STEPS : PORTAL_STEPS;
  const steps = defs.map((s) => ({ ...s, done: doneKeys.has(s.key) || derived.has(s.key) }));
  const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  return { steps, pct, dismissed };
}
