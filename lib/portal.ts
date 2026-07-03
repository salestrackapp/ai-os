import "server-only";
import { cookies } from "next/headers";
import { currentMembership } from "@/lib/auth";

export type PortalCtx = { orgId: string | null; isAdmin: boolean; adminView: boolean; userId: string; email: string | null; role: string | null };

/**
 * Resolve a org do portal:
 * - cliente → sua própria org (isolamento normal);
 * - admin Salestrack → a org selecionada via cookie 'aios_view_org' (modo "ver como"), com controle total.
 */
export async function resolvePortalOrg(): Promise<PortalCtx | null> {
  const m = await currentMembership();
  if (!m) return null;
  if (m.isSalestrackAdmin) {
    const org = (await cookies()).get("aios_view_org")?.value ?? null;
    return { orgId: org, isAdmin: true, adminView: !!org, userId: m.userId, email: m.email, role: m.role };
  }
  return { orgId: m.orgId, isAdmin: false, adminView: false, userId: m.userId, email: m.email, role: m.role };
}
