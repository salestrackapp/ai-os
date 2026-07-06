import "server-only";

/** Faturamento Stripe ativo? Sem chave → modo manual (admin gere assinaturas/faturas à mão). */
export function hasBilling(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

const BASE = "https://api.stripe.com/v1";
async function stripe(path: string, body: Record<string, string>): Promise<Record<string, unknown> | null> {
  if (!hasBilling()) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
    return await res.json();
  } catch { return null; }
}

/** Cria (ou reaproveita) um customer + subscription no Stripe para a mensalidade da plataforma.
 *  Retorna ids do Stripe, ou null quando em modo manual. */
export async function createStripeSubscription(opts: { email: string; name: string; priceId: string }): Promise<{ customerId: string; subscriptionId: string } | null> {
  if (!hasBilling() || !opts.priceId) return null;
  const cust = await stripe("/customers", { email: opts.email, name: opts.name });
  const customerId = String(cust?.id ?? "");
  if (!customerId) return null;
  const sub = await stripe("/subscriptions", { customer: customerId, "items[0][price]": opts.priceId });
  const subscriptionId = String(sub?.id ?? "");
  if (!subscriptionId) return null;
  return { customerId, subscriptionId };
}
