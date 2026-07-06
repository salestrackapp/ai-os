"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { resolvePortalOrg } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import { DISMISS_KEY } from "./first-steps";

type Surface = "admin" | "portal";

async function ctx(surface: Surface): Promise<{ userId: string; orgId: string } | null> {
  if (surface === "admin") { const m = await currentMembership(); return m?.userId && m?.orgId ? { userId: m.userId, orgId: m.orgId } : null; }
  const m = await resolvePortalOrg(); return m?.userId && m?.orgId ? { userId: m.userId, orgId: m.orgId } : null;
}
const surfacePath = (s: Surface) => (s === "admin" ? "/admin/hoje" : "/portal");

/** Marca um passo dos Primeiros passos como visto. */
export async function markGuideStep(surface: Surface, key: string) {
  const c = await ctx(surface); if (!c) return;
  await createServiceClient().from("onboarding_progress").upsert(
    { org_id: c.orgId, user_id: c.userId, surface, key, done_at: new Date().toISOString() },
    { onConflict: "user_id,surface,key" },
  );
  revalidatePath(surfacePath(surface));
}

/** Dispensa o painel (fica fechado; nunca reaparece sozinho). */
export async function dismissGuide(surface: Surface) {
  const c = await ctx(surface); if (!c) return;
  await createServiceClient().from("onboarding_progress").upsert(
    { org_id: c.orgId, user_id: c.userId, surface, key: DISMISS_KEY, done_at: new Date().toISOString() },
    { onConflict: "user_id,surface,key" },
  );
  revalidatePath(surfacePath(surface));
}

/** Reabre o painel (remove a dispensa) pelo link discreto. */
export async function reopenGuide(surface: Surface) {
  const c = await ctx(surface); if (!c) return;
  await createServiceClient().from("onboarding_progress").delete().eq("user_id", c.userId).eq("surface", surface).eq("key", DISMISS_KEY);
  revalidatePath(surfacePath(surface));
}
