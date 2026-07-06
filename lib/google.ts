import "server-only";

/** Google (conta Salestrack) configurado? client id+secret+refresh token. */
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
}

/** Troca o refresh token por um access token de curta duração. Null se não configurado/erro. */
async function accessToken(): Promise<string | null> {
  if (!googleConfigured()) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!, grant_type: "refresh_token",
      }),
    });
    const d = await res.json();
    return d.access_token ?? null;
  } catch { return null; }
}

/** Envia um e-mail pela conta Salestrack via Gmail API. Retorna {sent, id} ou {sent:false} degradado. */
export async function sendGmail(to: string, subject: string, body: string): Promise<{ sent: boolean; id?: string }> {
  const token = await accessToken();
  if (!token) return { sent: false };
  const from = process.env.GOOGLE_SENDER_EMAIL || "me";
  // Subject com acentos precisa de MIME encoded-word (RFC 2047), senão vira mojibake.
  const encSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const raw = [
    `To: ${to}`, `From: ${from}`, `Subject: ${encSubject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", body,
  ].join("\r\n");
  const encoded = Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: encoded }),
    });
    const d = await res.json();
    return { sent: !!d.id, id: d.id };
  } catch { return { sent: false }; }
}

export type GEvent = { summary: string; when: string | null; attendees: string[]; ref: string | null };
/** Lista mensagens recentes do Gmail que casem com uma query (ex.: um domínio). Vazio se degradado. */
export async function listGmail(query: string, max = 10): Promise<{ summary: string; from: string | null; when: string | null; ref: string }[]> {
  const token = await accessToken();
  if (!token) return [];
  try {
    const list = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`, { headers: { authorization: `Bearer ${token}` } })).json();
    const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id);
    const out = [];
    for (const id of ids) {
      const msg = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { authorization: `Bearer ${token}` } })).json();
      const h: Record<string, string> = Object.fromEntries((msg.payload?.headers ?? []).map((x: { name: string; value: string }) => [x.name.toLowerCase(), x.value]));
      out.push({ summary: h.subject ?? "(sem assunto)", from: h.from ?? null, when: h.date ? new Date(h.date).toISOString() : null, ref: id });
    }
    return out;
  } catch { return []; }
}

/** Lista eventos futuros/recentes do Calendar que casem com um texto. Vazio se degradado. */
export async function listCalendar(query: string, max = 10): Promise<GEvent[]> {
  const token = await accessToken();
  if (!token) return [];
  try {
    const timeMin = new Date(Date.now() - 90 * 86400000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(query)}&timeMin=${timeMin}&maxResults=${max}&singleEvents=true&orderBy=startTime`;
    const d = await (await fetch(url, { headers: { authorization: `Bearer ${token}` } })).json();
    return (d.items ?? []).map((e: Record<string, unknown>) => ({
      summary: (e.summary as string) ?? "(reunião)",
      when: ((e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date) ?? null,
      attendees: Array.isArray(e.attendees) ? (e.attendees as { email: string }[]).map((a) => a.email) : [],
      ref: (e.id as string) ?? null,
    }));
  } catch { return []; }
}
