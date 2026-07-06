import "server-only";
import { currentMembership } from "@/lib/auth";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import type { Surface } from "./types";

export const TOUR_KEY = "tour";

async function ctx(surface: Surface): Promise<{ userId: string; orgId: string } | null> {
  if (surface === "admin") { const m = await currentMembership(); return m?.userId && m?.orgId ? { userId: m.userId, orgId: m.orgId } : null; }
  const m = await resolvePortalOrg(); return m?.userId && m?.orgId ? { userId: m.userId, orgId: m.orgId } : null;
}

/**
 * O tour da superfície já foi visto (concluído/pulado/fechado) por este usuário?
 * Usado no layout para decidir a auto-abertura no 1º acesso.
 */
export async function tourSeen(surface: Surface): Promise<boolean> {
  const c = await ctx(surface);
  if (!c) return true; // sem contexto → não auto-abre
  const { data } = await createServiceClient()
    .from("onboarding_progress")
    .select("id")
    .eq("user_id", c.userId).eq("surface", surface).eq("key", TOUR_KEY)
    .maybeSingle();
  return !!data;
}
