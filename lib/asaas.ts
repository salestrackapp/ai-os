import "server-only";
import { getProviderConfig } from "@/lib/settings/secrets";

/**
 * Adapter ASAAS (https://docs.asaas.com) — clientes, cobranças (boleto/Pix) e assinaturas.
 * Config vem do Console (integration_secrets provider 'asaas') → env: api_key, webhook_token, env(sandbox|produção).
 * Base: produção https://api.asaas.com/v3 · sandbox https://api-sandbox.asaas.com/v3.
 * Auth: header `access_token`. Webhook: /api/asaas/webhook (header asaas-access-token = webhook_token).
 * Modo degradado: sem chave, o billing cai no fluxo manual.
 */
async function resolveAsaas(): Promise<{ key: string; base: string }> {
  const c = await getProviderConfig("asaas");
  const key = c.api_key ?? "";
  const sandbox = (c.env ?? "").toLowerCase().startsWith("sand");
  const base = (sandbox ? "https://api-sandbox.asaas.com" : "https://api.asaas.com") + "/v3";
  return { key, base };
}

/** ASAAS configurado? (Console ou env). */
export async function asaasConfigured(): Promise<boolean> {
  return !!(await resolveAsaas()).key;
}

async function asaas(path: string, init?: { method?: string; body?: unknown }) {
  const { key, base } = await resolveAsaas();
  const res = await fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "AI-OS-Salestrack" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.errors?.[0]?.description ?? `ASAAS ${res.status}`);
  return json;
}

/** Cria/reusa cliente por CNPJ/e-mail. */
export async function ensureAsaasCustomer(opts: { name: string; email?: string | null; cpfCnpj?: string | null; externalReference?: string }): Promise<string> {
  if (opts.cpfCnpj) {
    const found = await asaas(`/customers?cpfCnpj=${encodeURIComponent(opts.cpfCnpj.replace(/\D/g, ""))}`);
    if (found?.data?.length) return found.data[0].id;
  } else if (opts.email) {
    const found = await asaas(`/customers?email=${encodeURIComponent(opts.email)}`);
    if (found?.data?.length) return found.data[0].id;
  }
  const c = await asaas("/customers", { method: "POST", body: { name: opts.name, email: opts.email ?? undefined, cpfCnpj: opts.cpfCnpj?.replace(/\D/g, "") || undefined, externalReference: opts.externalReference } });
  return c.id;
}

export type AsaasBilling = {
  customerId: string;
  payments: { asaasId: string; invoiceUrl: string | null; installmentN: number; amount: number; dueDate: string }[];
  subscription: { asaasId: string; amount: number } | null;
};

/** N cobranças de implantação (BOLETO com Pix embutido, vencimentos mensais) + assinatura mensal. */
export async function startBillingAsaas(opts: {
  orgName: string; email?: string | null; cpfCnpj?: string | null; contractId: string;
  total: number; installments: number; monthlyFee: number;
}): Promise<AsaasBilling> {
  const customerId = await ensureAsaasCustomer({ name: opts.orgName, email: opts.email, cpfCnpj: opts.cpfCnpj, externalReference: opts.contractId });
  const n = Math.max(1, opts.installments || 1);
  const parcela = Math.round((opts.total / n) * 100) / 100;
  const payments: AsaasBilling["payments"] = [];
  for (let i = 1; i <= n; i++) {
    const dueDate = new Date(Date.now() + 30 * i * 86_400_000).toISOString().slice(0, 10);
    const p = await asaas("/payments", { method: "POST", body: {
      customer: customerId, billingType: "BOLETO", value: parcela, dueDate,
      description: `Implantação — parcela ${i}/${n}`, externalReference: `${opts.contractId}:${i}`,
    } });
    payments.push({ asaasId: p.id, invoiceUrl: p.invoiceUrl ?? p.bankSlipUrl ?? null, installmentN: i, amount: parcela, dueDate });
  }
  let subscription: AsaasBilling["subscription"] = null;
  if (opts.monthlyFee > 0) {
    const nextDue = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const s = await asaas("/subscriptions", { method: "POST", body: {
      customer: customerId, billingType: "BOLETO", value: opts.monthlyFee, nextDueDate: nextDue,
      cycle: "MONTHLY", description: "Plataforma AI OS — mensalidade", externalReference: opts.contractId,
    } });
    subscription = { asaasId: s.id, amount: opts.monthlyFee };
  }
  return { customerId, payments, subscription };
}
