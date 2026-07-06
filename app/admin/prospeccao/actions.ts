"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { scoreProspect, scoreAccount } from "@/lib/prospecting/score";
import { apolloConfigured, apolloSearchPeople } from "@/lib/apollo";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}
function domainFrom(email: string | null, domain: string | null): string | null {
  if (domain) return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  if (email && email.includes("@")) return email.split("@")[1].toLowerCase();
  return null;
}

/** Localiza ou cria a conta-alvo por domínio. */
async function upsertAccount(sb: SupabaseClient, opts: { name: string; domain: string | null; icp: string | null; industry?: string | null; size?: string | null; signals?: string[] }, ownerId: string): Promise<string | null> {
  const dom = opts.domain;
  if (dom) {
    const { data: found } = await sb.from("prospect_accounts").select("id").ilike("domain", dom).limit(1).maybeSingle();
    if (found) return found.id;
  }
  const signals = opts.signals ?? [];
  const row = { name: opts.name || dom || "Conta", domain: dom, icp: opts.icp, industry: opts.industry ?? null, size: opts.size ?? null, signals, owner: ownerId };
  const score = scoreAccount(row);
  const { data } = await sb.from("prospect_accounts").insert({ ...row, score, source: "import" }).select("id").single();
  return data?.id ?? null;
}

type RowIn = { name: string; title?: string; email?: string; company?: string; domain?: string; icp?: string; linkedin?: string; seniority?: string; industry?: string; size?: string; signals?: string[]; apollo_id?: string; source?: string };

/** Cria um prospect (com conta + score) evitando duplicidade por email/apollo_id. Retorna 'created'|'dup'. */
async function createProspect(sb: SupabaseClient, r: RowIn, ownerId: string): Promise<"created" | "dup" | "skip"> {
  if (!r.name) return "skip";
  const email = (r.email ?? "").trim().toLowerCase() || null;
  const apolloId = r.apollo_id ?? null;
  if (email || apolloId) {
    const or = [email ? `email.eq.${email}` : null, apolloId ? `apollo_id.eq.${apolloId}` : null].filter(Boolean).join(",");
    const { data: dup } = await sb.from("prospects").select("id").or(or).limit(1).maybeSingle();
    if (dup) return "dup";
  }
  const dom = domainFrom(email, r.domain ?? null);
  const icp = r.icp ?? null;
  const accountId = await upsertAccount(sb, { name: r.company ?? dom ?? r.name, domain: dom, icp, industry: r.industry, size: r.size, signals: r.signals }, ownerId);
  const { data: acc } = accountId ? await sb.from("prospect_accounts").select("*").eq("id", accountId).single() : { data: null };
  const prospect = { account_id: accountId, name: r.name, title: r.title ?? null, seniority: r.seniority ?? null, icp, email, linkedin_url: r.linkedin ?? null, apollo_id: apolloId, source: r.source ?? "manual" };
  const score = scoreProspect(prospect, acc);
  const { error } = await sb.from("prospects").insert({ ...prospect, score, status: "novo" });
  if (error) throw new Error(error.message);
  return "created";
}

/** Importa colando linhas (CSV/TSV) com cabeçalho flexível. Dedup por email/apollo_id. */
export async function importPasted(formData: FormData) {
  const m = await requireAdmin();
  const raw = String(formData.get("data") ?? "").trim();
  const icpDefault = String(formData.get("icp") ?? "") || undefined;
  if (!raw) throw new Error("Cole ao menos uma linha.");
  const sb = await createClient();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(delim).map((h) => h.trim());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const cols = {
    name: idx(["name", "nome"]), title: idx(["title", "cargo"]), email: idx(["email", "e-mail"]),
    company: idx(["company", "empresa", "organization"]), domain: idx(["domain", "dominio", "website"]),
    icp: idx(["icp"]), linkedin: idx(["linkedin", "linkedin_url"]), seniority: idx(["seniority", "senioridade"]),
    industry: idx(["industry", "industria", "setor"]), size: idx(["size", "porte", "tamanho"]), signals: idx(["signals", "sinais"]),
  };
  const hasHeader = cols.name >= 0 || cols.email >= 0;
  const body = hasHeader ? lines.slice(1) : lines;
  let created = 0, dup = 0, skip = 0;
  for (const line of body) {
    const c = line.split(delim).map((x) => x.trim());
    const get = (i: number) => (i >= 0 && i < c.length ? c[i] : "");
    const row: RowIn = hasHeader
      ? { name: get(cols.name), title: get(cols.title), email: get(cols.email), company: get(cols.company), domain: get(cols.domain), icp: get(cols.icp) || icpDefault, linkedin: get(cols.linkedin), seniority: get(cols.seniority), industry: get(cols.industry), size: get(cols.size), signals: get(cols.signals) ? get(cols.signals).split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [], source: "manual" }
      : { name: c[0], title: c[1], email: c[2], company: c[3], icp: icpDefault, source: "manual" };
    const res = await createProspect(sb, row, m.userId);
    if (res === "created") created++; else if (res === "dup") dup++; else skip++;
  }
  await audit("prospect.import", "prospects", undefined, { created, dup, skip, via: "paste" }, undefined);
  revalidatePath("/admin/prospeccao");
}

/** Adiciona um prospect manualmente. */
export async function addProspectManual(formData: FormData) {
  const m = await requireAdmin();
  const sb = await createClient();
  const row: RowIn = {
    name: String(formData.get("name") ?? "").trim(), title: String(formData.get("title") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(), company: String(formData.get("company") ?? "").trim(),
    icp: String(formData.get("icp") ?? "") || undefined, linkedin: String(formData.get("linkedin") ?? "").trim(),
    seniority: String(formData.get("seniority") ?? "").trim(),
    signals: String(formData.get("signals") ?? "").split(/[;,|]/).map((s) => s.trim()).filter(Boolean),
    source: String(formData.get("source") ?? "manual"),
  };
  if (!row.name) throw new Error("Nome é obrigatório.");
  const res = await createProspect(sb, row, m.userId);
  await audit("prospect.add", "prospects", undefined, { via: "manual", res }, undefined);
  revalidatePath("/admin/prospeccao");
}

/** Importa do Apollo em LOTE (várias páginas) por títulos de ICP. Degrada se sem chave. */
export async function importFromApollo(formData: FormData) {
  const m = await requireAdmin();
  if (!apolloConfigured()) throw new Error("APOLLO_API_KEY não configurada — use colar CSV ou adicionar manual.");
  const icp = String(formData.get("icp") ?? "icp1");
  const alvo = Math.min(500, Math.max(25, parseInt(String(formData.get("qtd") ?? "50"), 10) || 50)); // quantos trazer
  const titlesByIcp: Record<string, string[]> = {
    icp1: ["CEO", "Founder", "Co-Founder", "Owner", "Presidente"],
    icp2: ["Head of Sales", "Sales Manager", "Marketing Manager", "Gerente Comercial", "Gerente de Marketing"],
    icp3: ["COO", "CFO", "Director of Operations", "Diretor de Operações", "Diretor Financeiro"],
  };
  const PER = 25, maxPages = Math.ceil(alvo / PER);
  const sb = await createClient();
  let created = 0, dup = 0, visto = 0;
  for (let page = 1; page <= maxPages; page++) {
    const people = await apolloSearchPeople({ titles: titlesByIcp[icp] ?? [], perPage: PER, page });
    if (people.length === 0) break; // acabou o resultado
    for (const p of people) {
      if (visto >= alvo) break;
      visto++;
      const res = await createProspect(sb, { name: p.name, title: p.title ?? undefined, email: p.email ?? undefined, company: p.org_name ?? undefined, domain: p.domain ?? undefined, icp, linkedin: p.linkedin_url ?? undefined, seniority: p.seniority ?? undefined, apollo_id: p.apollo_id ?? undefined, source: "apollo" }, m.userId);
      if (res === "created") created++; else if (res === "dup") dup++;
    }
    if (visto >= alvo) break;
  }
  await audit("prospect.import", "prospects", undefined, { created, dup, via: "apollo", icp, alvo }, undefined);
  revalidatePath("/admin/prospeccao");
}
