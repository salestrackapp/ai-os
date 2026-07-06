import { extractVars } from "@/lib/studio/copy/channel";

/** Destinatário real (PII vive só aqui, no servidor, nunca gravada no ativo). */
export type Recipient = { nome?: string; empresa?: string; email?: string; phone?: string; [k: string]: string | undefined };

/** Aliases comuns de variáveis → campo do destinatário. */
function value(v: string, r: Recipient): string | undefined {
  const key = v.toLowerCase();
  if ((key === "nome" || key === "first_name" || key === "primeiro_nome") && r.nome) return r.nome.split(" ")[0];
  if ((key === "nome_completo" || key === "name") && r.nome) return r.nome;
  if ((key === "empresa" || key === "company") && r.empresa) return r.empresa;
  if (key === "email" && r.email) return r.email;
  return r[key];
}

/** Resolve {{variaveis}} de um texto com o destinatário real. Retorna o texto e as faltantes. */
export function resolveVars(text: string, recipient: Recipient): { resolved: string; missing: string[] } {
  const vars = extractVars(text || "");
  const missing: string[] = [];
  const resolved = (text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, v: string) => {
    const val = value(v, recipient);
    if (val == null || val === "") { missing.push(v); return `{{${v}}}`; }
    return val;
  });
  return { resolved, missing: [...new Set(missing)] };
}

/**
 * Resolve TODAS as strings de um ativo (texto/email) e valida obrigatórias.
 * BLOQUEIA (ok=false) se faltar variável — nunca envia placeholder cru.
 */
export function resolveAsset(parts: string[], recipient: Recipient): { ok: boolean; resolved: string[]; missing: string[] } {
  const missing = new Set<string>();
  const resolved = parts.map((p) => {
    const r = resolveVars(p, recipient);
    r.missing.forEach((m) => missing.add(m));
    return r.resolved;
  });
  return { ok: missing.size === 0, resolved, missing: [...missing] };
}
