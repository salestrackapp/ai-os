import "server-only";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalOrg } from "@/lib/portal";
import { adminNextActions, portalNextActions, type Suggestion } from "@/lib/guidance/next-actions";

/**
 * "Comece por aqui" — 1 a 3 cards copiloto (achado + ação) derivados do estado real.
 * Some por completo quando não há o que sugerir (nunca placeholder vazio).
 */
export async function NextActions({ surface, areaKey }: { surface: "admin" | "portal"; areaKey: string }) {
  const supabase = await createClient();
  let items: Suggestion[] = [];
  if (surface === "admin") items = await adminNextActions(supabase, areaKey);
  else { const m = await resolvePortalOrg(); if (m?.orgId) items = await portalNextActions(supabase, m.orgId, areaKey); }
  if (!items.length) return null;

  return (
    <div className="mb-7">
      <p className="ds-eyebrow mb-3">Comece por aqui</p>
      <div className={`grid gap-3 ${items.length > 1 ? "lg:grid-cols-3" : ""}`}>
        {items.map((s, i) => (
          <Link key={i} href={s.href}
            className="ds-focus group flex items-center gap-3 rounded-ds-card border border-hairline bg-[var(--bg-1)] p-4 shadow-ds-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:rgba(79,31,255,0.28)] hover:shadow-ds-md">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tile)] text-[color:var(--brand)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.29 1.29L3 12l5.8 1.9a2 2 0 0 1 1.29 1.29L12 21l1.9-5.8a2 2 0 0 1 1.29-1.29L21 12l-5.8-1.9a2 2 0 0 1-1.29-1.29Z" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-montserrat text-[13px] font-medium leading-snug text-[color:var(--fg-1)]">{s.finding}</span>
              <span className="mt-1 inline-flex items-center gap-1 font-montserrat text-[12px] font-semibold text-[color:var(--brand)]">{s.label} <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
