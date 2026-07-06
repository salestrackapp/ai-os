/**
 * Regras de canal + merge fields (R3.6). Puro/testável.
 * O Estúdio produz a copy dentro das regras; o preenchimento de variáveis é do envio (R4).
 */

/** Extrai nomes de variáveis {{nome}} de um texto. */
export function extractVars(text: string): string[] {
  return [...new Set([...(text || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))];
}

/** Merge fields: variáveis usadas no texto devem estar declaradas; retorna divergências. */
export function validateMergeFields(text: string, declared: string[]): { ok: boolean; undeclared: string[]; unused: string[] } {
  const used = extractVars(text);
  const d = new Set(declared.map((s) => s.replace(/[{}]/g, "").trim()));
  const undeclared = used.filter((v) => !d.has(v));
  const unused = [...d].filter((v) => !used.includes(v));
  return { ok: undeclared.length === 0, undeclared, unused };
}

/**
 * Detecta PII real embutida (e-mail, telefone BR, CPF). A produção guarda PLACEHOLDERS —
 * PII real é bloqueada na aprovação; preenchimento acontece no envio (R4).
 */
export function detectPII(text: string): { emails: string[]; phones: string[]; cpfs: string[]; has: boolean } {
  const t = text || "";
  const emails = [...t.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map((m) => m[0]);
  const cpfs = [...t.matchAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g)].map((m) => m[0]);
  // telefone: 10-11 dígitos, tolera +55/() -; evita casar CPF (11 díg. com pontuação de cpf já saiu acima)
  const phones = [...t.matchAll(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g)].map((m) => m[0]).filter((p) => p.replace(/\D/g, "").length >= 10);
  const has = emails.length + phones.length + cpfs.length > 0;
  return { emails, phones, cpfs, has };
}

export type ChannelKey = "post" | "mensagem" | "whatsapp" | "email";
export const CHANNEL_LIMITS: Record<ChannelKey, { maxLen: number; label: string }> = {
  post: { maxLen: 3000, label: "Post" },
  mensagem: { maxLen: 600, label: "Mensagem" },
  whatsapp: { maxLen: 1000, label: "WhatsApp" },
  email: { maxLen: 8000, label: "E-mail marketing" },
};

/** Regras de formatação por canal (usadas na validação da linha). */
export function channelIssues(channel: ChannelKey, text: string): string[] {
  const issues: string[] = [];
  const lim = CHANNEL_LIMITS[channel];
  if ((text || "").length > lim.maxLen) issues.push(`Excede o limite de ${lim.maxLen} caracteres do ${lim.label}.`);
  if (channel === "whatsapp" && /<[a-z][\s\S]*>/i.test(text)) issues.push("WhatsApp é texto puro — sem HTML.");
  return issues;
}
