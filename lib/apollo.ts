import "server-only";
import { getSecret } from "@/lib/settings/secrets";

const TIMEOUT_MS = 15_000;

/** Chave: Console (integration_secrets) → env. Nunca ler process.env direto. */
async function apolloKey(): Promise<string | null> {
  return await getSecret("apollo");
}

/** Apollo configurado? Sem chave → importação cai para CSV/manual. */
export async function apolloConfigured(): Promise<boolean> {
  return !!(await apolloKey());
}

/** Toda chamada tem timeout: sem ele, uma resposta pendurada do Apollo trava a rota. */
async function apolloFetch(url: string, init: RequestInit, key: string): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "cache-control": "no-cache", "x-api-key": key },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * O que a BUSCA devolve — e é menos do que parece.
 *
 * O endpoint `mixed_people/api_search` entrega o registro MASCARADO: sobrenome ofuscado
 * (`last_name_obfuscated: "Gui"` no lugar de "Guimarães"), sem e-mail, sem domínio da empresa.
 * O que ele dá é a flag `has_email`, dizendo que o dado EXISTE do outro lado.
 *
 * Foi exatamente isso que inutilizou a primeira leva de 27 prospects: nomes pela metade e e-mail
 * nulo. Não é bug da nossa parte nem limitação do plano — é como este endpoint funciona. O dado
 * real vem do `people/match` pelo `apollo_id`, e é lá que o crédito é cobrado.
 *
 * Por isso `name` aqui é parcial e `hasEmail` é o campo que decide se vale gastar crédito.
 */
export type ApolloPerson = {
  name: string; title: string | null; email: string | null; linkedin_url: string | null;
  seniority: string | null; org_name: string | null; domain: string | null; apollo_id: string | null;
  hasEmail: boolean;
};

/**
 * Busca UMA página de pessoas no Apollo. Degrada para [] sem chave/erro.
 *
 * Os filtros de LOCAL, SETOR e PORTE não são refinamento opcional — são o que separa prospecção
 * direcionada de varredura em massa, e o teste de proporcionalidade do legítimo interesse
 * (docs/LIA_PROSPECCAO.md) se apoia nessa distinção. Uma busca sem eles traz gente que nunca teve
 * o problema que resolvemos, e tratar o dado dessas pessoas não tem finalidade legítima.
 *
 * `locations` filtra a PESSOA (onde ela trabalha), não a sede da empresa: é o recorte que importa
 * para quem vende no Brasil.
 */
export async function apolloSearchPeople(opts: {
  titles?: string[]; seniorities?: string[]; domains?: string[];
  locations?: string[]; industries?: string[]; employeeRanges?: string[]; keywords?: string;
  perPage?: number; page?: number;
}): Promise<ApolloPerson[]> {
  const key = await apolloKey();
  if (!key) return [];
  const naoVazio = (a?: string[]) => (a && a.length ? a : undefined);
  // Endpoint atual (o antigo mixed_people/search foi deprecado).
  const data = await apolloFetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    body: JSON.stringify({
      person_titles: opts.titles ?? [],
      person_seniorities: naoVazio(opts.seniorities),
      q_organization_domains_list: naoVazio(opts.domains),
      person_locations: naoVazio(opts.locations),
      organization_industry_tag_ids: undefined,          // o Apollo espera ID, não nome
      q_organization_keyword_tags: naoVazio(opts.industries),
      organization_num_employees_ranges: naoVazio(opts.employeeRanges),
      q_keywords: opts.keywords || undefined,
      page: opts.page ?? 1, per_page: Math.min(100, opts.perPage ?? 25),
    }),
  }, key);
  const people = Array.isArray(data?.people) ? (data.people as Record<string, unknown>[]) : [];
  return people.map((p) => {
    const org = (p.organization as Record<string, unknown>) ?? {};
    const last = (p.last_name as string) ?? (p.last_name_obfuscated as string) ?? "";
    return {
      name: String(p.name ?? `${p.first_name ?? ""} ${last}`).trim(),  // parcial: sobrenome ofuscado
      title: (p.title as string) ?? null,
      email: (p.email as string) ?? null,                              // sempre nulo neste endpoint
      linkedin_url: (p.linkedin_url as string) ?? null,
      seniority: (p.seniority as string) ?? null,
      org_name: (org.name as string) ?? null,
      domain: (org.primary_domain as string) ?? (org.website_url as string) ?? null,
      apollo_id: (p.id as string) ?? null,
      // A busca não entrega o e-mail, mas diz se ele existe. É o que evita gastar crédito com
      // quem não tem — e crédito gasto à toa não volta.
      hasEmail: p.has_email === true || !!p.email,
    };
  });
}

export type ApolloEnrichedPerson = {
  name: string | null; email: string | null; phone: string | null; title: string | null;
  seniority: string | null;
  linkedin_url: string | null; org_name: string | null; domain: string | null; apollo_id: string | null;
};

/**
 * Enriquece UMA pessoa. Consome crédito Apollo. Degrada para null sem chave/erro.
 *
 * **Sempre que houver `apolloId`, use ele.** Casar por nome não funciona com o resultado da
 * busca, porque o sobrenome que vem de lá é ofuscado — pedir match de "Alexandre Gui" devolve
 * nada, e o crédito é cobrado do mesmo jeito. Com o id, volta o registro completo.
 *
 * `reveal_personal_emails: false` é deliberado: a política é tratar só dado corporativo, e a
 * regra fica dita também para o fornecedor, não só no nosso gatilho.
 */
export async function apolloEnrichPerson(input: { apolloId?: string; firstName?: string; lastName?: string; email?: string; companyName?: string }): Promise<ApolloEnrichedPerson | null> {
  const key = await apolloKey();
  if (!key) return null;
  const data = await apolloFetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    body: JSON.stringify(input.apolloId
      ? { id: input.apolloId, reveal_personal_emails: false }
      : {
          first_name: input.firstName, last_name: input.lastName,
          email: input.email, organization_name: input.companyName,
          reveal_personal_emails: false,
        }),
  }, key);
  const p = (data?.person as Record<string, unknown>) ?? null;
  if (!p) return null;
  const org = (p.organization as Record<string, unknown>) ?? {};
  const phones = (p.phone_numbers as Record<string, unknown>[]) ?? [];
  return {
    name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null,
    email: (p.email as string) ?? null,
    phone: (phones[0]?.sanitized_number as string) ?? null,
    seniority: (p.seniority as string) ?? null,
    title: (p.title as string) ?? null,
    linkedin_url: (p.linkedin_url as string) ?? null,
    org_name: (org.name as string) ?? null,
    domain: (org.primary_domain as string) ?? null,
    apollo_id: (p.id as string) ?? null,
  };
}

export type ApolloEnrichedCompany = {
  name: string | null; domain: string | null; website: string | null; industry: string | null;
  size: string | null; phone: string | null; city: string | null; country: string | null; description: string | null;
};

/**
 * Enriquece UMA empresa pelo domínio.
 * O domínio é obrigatório de propósito: a versão do crm-premium fabricava um domínio a partir do
 * nome (nome.toLowerCase() + ".com") quando ele faltava, o que enriquecia a empresa errada em
 * silêncio. Sem domínio, retorna null.
 */
export async function apolloEnrichCompany(input: { domain: string }): Promise<ApolloEnrichedCompany | null> {
  const key = await apolloKey();
  const domain = input.domain?.trim();
  if (!key || !domain) return null;
  const data = await apolloFetch(
    "https://api.apollo.io/api/v1/organizations/enrich?" + new URLSearchParams({ domain }),
    { method: "GET" }, key,
  );
  const o = (data?.organization as Record<string, unknown>) ?? null;
  if (!o) return null;
  return {
    name: (o.name as string) ?? null,
    domain: (o.primary_domain as string) ?? domain,
    website: (o.website_url as string) ?? null,
    industry: (o.industry as string) ?? null,
    size: o.estimated_num_employees ? String(o.estimated_num_employees) : null,
    phone: (o.phone as string) ?? null,
    city: (o.city as string) ?? null,
    country: (o.country as string) ?? null,
    description: (o.short_description as string) ?? null,
  };
}

/**
 * Mescla sem destruir: o valor que já existe SEMPRE vence o que veio do Apollo.
 * Enriquecimento nunca sobrescreve dado que alguém digitou ou confirmou.
 */
export type ApolloVaga = { titulo: string; local: string | null; postado_em: string | null };

/**
 * Vagas abertas da empresa — o sinal de crescimento que dá para obter por fonte licenciada.
 *
 * Vale registrar o que isto NÃO é: post, comentário e curtida no LinkedIn não vêm por aqui, e não
 * virão. Em compensação, uma empresa contratando para a área que a gente atende diz mais sobre
 * timing de compra do que uma curtida diz.
 *
 * Degrada para [] em qualquer falha: sinal é enriquecimento, nunca pode derrubar a coleta.
 */
export async function apolloVagasDaEmpresa(apolloOrgId: string): Promise<ApolloVaga[]> {
  const key = await apolloKey();
  if (!key || !apolloOrgId) return [];
  const data = await apolloFetch(
    `https://api.apollo.io/api/v1/organizations/${encodeURIComponent(apolloOrgId)}/job_postings`,
    { method: "GET" }, key,
  );
  const vagas = Array.isArray(data?.organization_job_postings)
    ? (data.organization_job_postings as Record<string, unknown>[]) : [];
  return vagas.slice(0, 25).map((v) => ({
    titulo: String(v.title ?? "").trim(),
    local: (v.city as string) ?? (v.state as string) ?? null,
    postado_em: (v.posted_at as string) ?? null,
  })).filter((v) => v.titulo);
}

export function mergePreservandoExistente<T extends Record<string, unknown>>(atual: T, vindo: Partial<T>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vindo)) {
    const jaTem = atual[k];
    if (v != null && v !== "" && (jaTem == null || jaTem === "")) out[k] = v;
  }
  return out as Partial<T>;
}
