import "server-only";

/** Apollo configurado? Sem chave → importação cai para CSV/manual. */
export function apolloConfigured(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

export type ApolloPerson = { name: string; title: string | null; email: string | null; linkedin_url: string | null; seniority: string | null; org_name: string | null; domain: string | null; apollo_id: string | null };

/** Busca UMA página de pessoas no Apollo por filtros de ICP. Degrada para [] sem chave/erro. */
export async function apolloSearchPeople(opts: { titles?: string[]; seniorities?: string[]; domains?: string[]; perPage?: number; page?: number }): Promise<ApolloPerson[]> {
  if (!apolloConfigured()) return [];
  try {
    // Endpoint atual (o antigo mixed_people/search foi deprecado).
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "content-type": "application/json", "cache-control": "no-cache", "x-api-key": process.env.APOLLO_API_KEY! },
      body: JSON.stringify({
        person_titles: opts.titles ?? [],
        person_seniorities: opts.seniorities && opts.seniorities.length ? opts.seniorities : undefined,
        q_organization_domains_list: opts.domains && opts.domains.length ? opts.domains : undefined,
        page: opts.page ?? 1, per_page: Math.min(100, opts.perPage ?? 25),
      }),
    });
    const data = await res.json();
    const people = Array.isArray(data?.people) ? data.people : [];
    return people.map((p: Record<string, unknown>) => {
      const org = (p.organization as Record<string, unknown>) ?? {};
      const last = (p.last_name as string) ?? (p.last_name_obfuscated as string) ?? "";
      return {
        name: String(p.name ?? `${p.first_name ?? ""} ${last}`).trim(),
        title: (p.title as string) ?? null,
        email: (p.email as string) ?? null, // pode vir null (enriquecimento consome créditos)
        linkedin_url: (p.linkedin_url as string) ?? null,
        seniority: (p.seniority as string) ?? null,
        org_name: (org.name as string) ?? null,
        domain: (org.primary_domain as string) ?? (org.website_url as string) ?? null,
        apollo_id: (p.id as string) ?? null,
      };
    });
  } catch { return []; }
}
