import "server-only";

/**
 * MailerLite = audiência e campanhas de marketing.
 * O CRM sincroniza contatos (com e-mail) para o grupo "AI OS · CRM Salestrack";
 * as campanhas em si são criadas/geridas na plataforma MailerLite.
 * Modo degradado: sem MAILERLITE_API_KEY, loga e segue.
 */
const KEY = process.env.MAILERLITE_API_KEY;
const GROUP = process.env.MAILERLITE_GROUP_ID ?? "191945673127495219"; // AI OS · CRM Salestrack

export function mailerliteConfigured() { return !!KEY; }

/** Upsert do assinante no grupo do CRM (fire-and-forget; nunca quebra o fluxo). */
export async function syncContactToMailerLite(c: { email?: string | null; name?: string | null; company?: string | null }): Promise<void> {
  if (!c.email) return;
  if (!KEY) { console.warn("[mailerlite] não configurado — sync ignorado."); return; }
  try {
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: c.email, fields: { name: c.name ?? "", company: c.company ?? "" }, groups: [GROUP] }),
    });
    if (!res.ok && res.status !== 200 && res.status !== 201) console.warn("[mailerlite] sync falhou:", res.status);
  } catch (e) { console.warn("[mailerlite] erro:", (e as Error).message); }
}

/** Nurture comercial: adiciona um prospect aquecido ao grupo de nurture ("IA em Toda a Empresa").
 *  Sem env → retorna false (modo manual: o operador exporta o segmento). */
export async function addToNurture(c: { email?: string | null; name?: string | null; company?: string | null }): Promise<boolean> {
  if (!c.email || !KEY) return false;
  const group = process.env.MAILERLITE_NURTURE_GROUP_ID ?? GROUP;
  try {
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: c.email, fields: { name: c.name ?? "", company: c.company ?? "" }, groups: [group] }),
    });
    return res.ok || res.status === 200 || res.status === 201;
  } catch { return false; }
}
