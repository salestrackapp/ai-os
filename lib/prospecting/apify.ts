import "server-only";
import { getSecret } from "@/lib/settings/secrets";

/**
 * Adaptador do Apify — o executor da coleta externa.
 *
 * ── Por que um serviço, e não Playwright aqui ─────────────────────────────────────────────────
 * Função serverless não sustenta navegador, e IP de datacenter é bloqueado pelo LinkedIn em
 * minutos. O Apify resolve a infraestrutura: pool de IP residencial, retentativa, fila. O que ele
 * NÃO resolve — e nenhum serviço resolve — é o risco da conta cujo cookie for usado.
 *
 * ── O cookie é opcional de propósito ──────────────────────────────────────────────────────────
 * Vários actors operam sem sessão, lendo só o que é público. Esses não colocam conta nenhuma em
 * risco. Os que pedem `li_at` veem mais, e o preço é a conta do André. A configuração deixa a
 * escolha explícita (`usa_cookie`) em vez de embutir a decisão no código.
 *
 * ── O cookie é uma credencial completa ────────────────────────────────────────────────────────
 * `li_at` É a sessão: quem o tem, é a conta. Por isso vive em `integration_secrets` como qualquer
 * outra credencial, nunca aparece em log, nunca volta para a tela depois de salvo, e não entra em
 * `coleta_externa_execucoes` nem em `audit_logs`.
 */

const BASE = "https://api.apify.com/v2";

export async function apifyConfigurado(): Promise<boolean> {
  return !!(await getSecret("apify"));
}

type RunResultado = {
  ok: boolean; runId?: string; itens: Record<string, unknown>[];
  custoUsd?: number; erro?: string; bloqueado?: boolean;
};

/**
 * Roda um actor e espera o resultado.
 *
 * `timeoutMs` existe porque um actor travado prenderia a Server Action até o limite da plataforma.
 * Ao estourar, devolve o que houver — coleta parcial vale mais que erro.
 */
export async function rodarActor(
  actorId: string,
  input: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<RunResultado> {
  const token = await getSecret("apify");
  if (!token) return { ok: false, itens: [], erro: "Chave do Apify não configurada." };
  if (!actorId) return { ok: false, itens: [], erro: "Actor não configurado para este escopo." };

  const limite = opts?.timeoutMs ?? 240_000;
  const inicio = Date.now();

  try {
    const disparo = await fetch(
      `${BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
    );
    if (!disparo.ok) {
      const corpo = await disparo.text().catch(() => "");
      return { ok: false, itens: [], erro: `Apify recusou o disparo (${disparo.status}). ${corpo.slice(0, 160)}` };
    }
    const { data: run } = (await disparo.json()) as { data: { id: string; defaultDatasetId: string } };

    // Espera com intervalo crescente: começa curto para coleta rápida terminar logo, e alonga
    // para não martelar a API numa coleta longa.
    let espera = 3000;
    for (;;) {
      if (Date.now() - inicio > limite) {
        return { ok: false, runId: run.id, itens: [], erro: "A coleta passou do tempo limite e foi abandonada." };
      }
      await new Promise((r) => setTimeout(r, espera));
      espera = Math.min(15_000, Math.round(espera * 1.5));

      const st = await fetch(`${BASE}/actor-runs/${run.id}?token=${encodeURIComponent(token)}`);
      if (!st.ok) continue;
      const { data: estado } = (await st.json()) as {
        data: { status: string; usageTotalUsd?: number; defaultDatasetId: string };
      };

      if (estado.status === "SUCCEEDED") {
        const ds = await fetch(
          `${BASE}/datasets/${estado.defaultDatasetId}/items?token=${encodeURIComponent(token)}&clean=true&limit=1000`,
        );
        const itens = ds.ok ? ((await ds.json()) as Record<string, unknown>[]) : [];
        return { ok: true, runId: run.id, itens, custoUsd: estado.usageTotalUsd };
      }
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(estado.status)) {
        /**
         * Falha do actor é o sintoma mais provável de bloqueio pelo LinkedIn — e é o momento de
         * PARAR, não de tentar de novo. Insistir contra um bloqueio é o caminho mais curto para a
         * conta cair de vez. Quem chama trata `bloqueado` acionando a parada automática.
         */
        return {
          ok: false, runId: run.id, itens: [], custoUsd: estado.usageTotalUsd,
          bloqueado: true,
          erro: `A coleta terminou em ${estado.status}. Pode ser bloqueio do LinkedIn — a coleta foi pausada por segurança.`,
        };
      }
    }
  } catch (e) {
    return { ok: false, itens: [], erro: (e as Error).message };
  }
}

/** Lê um campo em qualquer das grafias que os actors usam. Cada um nomeia do seu jeito. */
export function campo(obj: Record<string, unknown>, ...nomes: string[]): string | null {
  for (const n of nomes) {
    const v = obj[n];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Extrai o objeto aninhado (`author`, `actor`, `profile`…) que o actor usar. */
export function objeto(obj: Record<string, unknown>, ...nomes: string[]): Record<string, unknown> | null {
  for (const n of nomes) {
    const v = obj[n];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return null;
}
