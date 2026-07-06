import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// Mapa setor→vertical (fallback por regra, sem depender de agente).
const RULES: { re: RegExp; vertical: string; template: string }[] = [
  { re: /sa[uú]de|cl[ií]nic|diagn[oó]stic|imagem|hospital|m[eé]dic|laborat[oó]ri|health/i, vertical: "saude_diagnostico", template: "saude_imago" },
  { re: /leil[aã]o|arte|galeria|auction|antiguidade|curador/i, vertical: "leilao_arte", template: "art_mg_12m" },
  { re: /varejo|retail|loja|com[eé]rcio|e-?commerce|moda|supermerc/i, vertical: "varejo", template: "varejo_std" },
];
const FALLBACK = { vertical: "pme_generico", template: "pme_generico" };

export type Recommendation = { templateKey: string; verticalKey: string; industry: string | null; justificativa: string; fallback: boolean };

function fromIndustry(industry: string | null): Recommendation {
  const ind = industry ?? "";
  for (const r of RULES) if (r.re.test(ind)) return { templateKey: r.template, verticalKey: r.vertical, industry, justificativa: `Setor "${ind}" → blueprint ${r.vertical} (frentes e tom do mercado).`, fallback: false };
  return { templateKey: FALLBACK.template, verticalKey: FALLBACK.vertical, industry, justificativa: industry ? `Setor "${industry}" sem blueprint dedicado → PME genérico.` : "Sem setor identificado → PME genérico.", fallback: true };
}

/** Recomenda o template a partir de um deal (via prospect→conta→indústria) ou de uma indústria explícita. */
export async function recommendTemplate(opts: { dealId?: string | null; industry?: string | null }): Promise<Recommendation> {
  let industry = opts.industry ?? null;
  if (!industry && opts.dealId) {
    const sb = createServiceClient();
    const { data: p } = await sb.from("prospects").select("account_id").eq("deal_id", opts.dealId).limit(1).maybeSingle();
    if (p?.account_id) { const { data: acc } = await sb.from("prospect_accounts").select("industry").eq("id", p.account_id).single(); industry = acc?.industry ?? null; }
  }
  return fromIndustry(industry);
}
