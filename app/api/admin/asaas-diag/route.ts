import { NextResponse, type NextRequest } from "next/server";
import { getProviderConfig } from "@/lib/settings/secrets";

/**
 * Diagnóstico do ASAAS: diz a QUAL ambiente e a QUAL conta a chave configurada responde.
 *
 * Existe porque a sincronização voltou com zero pagamentos enquanto as cobranças comprovadamente
 * existem — e as duas causas possíveis (ambiente sandbox ou conta diferente) são indistinguíveis
 * pelo resultado. Nunca devolve a chave, só o prefixo e o que a conta diz de si.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(req.url).searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = await getProviderConfig("asaas");
  const chave = cfg.api_key || process.env.ASAAS_API_KEY || "";
  const env = cfg.env || process.env.ASAAS_ENV || "(não definido)";
  const base = env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

  const diag: Record<string, unknown> = {
    ambiente_configurado: env,
    url_usada: base,
    // O prefixo do token do ASAAS já diz o ambiente: `$aact_prod_` vs `$aact_hmlg_`/`$aact_YTU`.
    prefixo_da_chave: chave ? chave.slice(0, 12) + "…" : "(ausente)",
    chave_parece_de: chave.includes("prod") ? "produção" : chave ? "sandbox/homologação" : "—",
  };

  try {
    const r = await fetch(`${base}/myAccount`, { headers: { access_token: chave } });
    const j = (await r.json()) as Record<string, unknown>;
    diag.conta = r.ok ? { nome: j.name, email: j.email, cnpj: j.cpfCnpj } : { erro: `HTTP ${r.status}` };
    const p = await fetch(`${base}/payments?limit=3`, { headers: { access_token: chave } });
    const pj = (await p.json()) as Record<string, unknown>;
    diag.pagamentos_visiveis = pj.totalCount ?? 0;
  } catch (e) {
    diag.erro = (e as Error).message;
  }

  return NextResponse.json(diag);
}
