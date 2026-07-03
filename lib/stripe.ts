import "server-only";

const KEY = process.env.STRIPE_SECRET_KEY;
const API = "https://api.stripe.com/v1";

export function stripeConfigured() { return !!KEY; }

async function stripe(path: string, params: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.append(k, String(v));
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`);
  return json;
}

export type BillingResult = {
  customerId: string;
  invoices: { stripeId: string; hostedUrl: string | null; installmentN: number; amount: number; dueDate: string }[];
  subscription: { stripeId: string; amount: number } | null;
};

/** Cria/reusa Customer, N faturas de implantação (send_invoice, vencimentos mensais) e a assinatura mensal. */
export async function startBillingStripe(opts: {
  orgName: string; email?: string | null; existingCustomerId?: string | null;
  total: number; installments: number; monthlyFee: number;
}): Promise<BillingResult> {
  let customerId = opts.existingCustomerId ?? "";
  if (!customerId) {
    const c = await stripe("/customers", { name: opts.orgName, email: opts.email ?? undefined });
    customerId = c.id;
  }
  const n = Math.max(1, opts.installments || 1);
  const parcela = Math.round((opts.total / n) * 100); // centavos
  const invoices: BillingResult["invoices"] = [];
  for (let i = 1; i <= n; i++) {
    const days = 30 * i;
    await stripe("/invoiceitems", { customer: customerId, amount: parcela, currency: "brl", description: `Implantação — parcela ${i}/${n}` });
    const inv = await stripe("/invoices", { customer: customerId, collection_method: "send_invoice", days_until_due: days, auto_advance: "true" });
    const due = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    invoices.push({ stripeId: inv.id, hostedUrl: inv.hosted_invoice_url ?? null, installmentN: i, amount: parcela / 100, dueDate: due });
  }
  let subscription: BillingResult["subscription"] = null;
  if (opts.monthlyFee > 0) {
    const prod = await stripe("/products", { name: "Plataforma AI OS" });
    const price = await stripe("/prices", { product: prod.id, currency: "brl", unit_amount: Math.round(opts.monthlyFee * 100), "recurring[interval]": "month" });
    const sub = await stripe("/subscriptions", { customer: customerId, "items[0][price]": price.id, collection_method: "send_invoice", days_until_due: 15 });
    subscription = { stripeId: sub.id, amount: opts.monthlyFee };
  }
  return { customerId, invoices, subscription };
}
