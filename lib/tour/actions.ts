"use server";
import { currentMembership } from "@/lib/auth";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import type { Surface } from "./types";
import { TOUR_KEY } from "./state";

async function ctx(surface: Surface): Promise<{ userId: string; orgId: string } | null> {
  if (surface === "admin") { const m = await currentMembership(); return m?.userId && m?.orgId ? { userId: m.userId, orgId: m.orgId } : null; }
  const m = await resolvePortalOrg(); return m?.userId && m?.orgId ? { userId: m.userId, orgId: m.orgId } : null;
}

/**
 * Marca o tour da superfície como visto (após fechar/pular/concluir).
 * A partir daqui NUNCA reabre sozinho — só pelo link "Fazer o tour". Idempotente.
 */
export async function markTourSeen(surface: Surface) {
  const c = await ctx(surface);
  if (!c) return;
  await createServiceClient().from("onboarding_progress").upsert(
    { org_id: c.orgId, user_id: c.userId, surface, key: TOUR_KEY, done_at: new Date().toISOString() },
    { onConflict: "user_id,surface,key" },
  );
}
