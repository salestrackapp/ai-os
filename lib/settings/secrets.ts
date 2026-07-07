import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";

const ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY", apollo: "APOLLO_API_KEY", google: "GOOGLE_OAUTH_REFRESH_TOKEN",
  readai: "READAI_WEBHOOK_TOKEN", mailerlite: "MAILERLITE_API_KEY", zapi: "ZAPI_TOKEN", slack: "SLACK_BOT_TOKEN", stripe: "STRIPE_SECRET_KEY",
};

/** Status por provedor (NUNCA retorna o segredo ao chamador). */
export async function getSecretStatuses(): Promise<Record<string, { status: string; last_tested_at: string | null; hasEnv: boolean }>> {
  const sb = createServiceClient();
  const { data } = await sb.from("integration_secrets").select("provider, status, last_tested_at, secret").is("org_id", null);
  const out: Record<string, { status: string; last_tested_at: string | null; hasEnv: boolean }> = {};
  for (const p of Object.keys(ENV_MAP)) {
    const row = (data ?? []).find((r) => r.provider === p);
    const hasEnv = !!process.env[ENV_MAP[p]];
    const has = !!row?.secret || hasEnv;
    out[p] = { status: row?.status ?? (has ? "configurado" : "ausente"), last_tested_at: row?.last_tested_at ?? null, hasEnv };
  }
  return out;
}

/** Lê o segredo em runtime: app (integration_secrets) → env. Server-only. */
export async function getSecret(provider: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb.from("integration_secrets").select("secret").eq("provider", provider).is("org_id", null).maybeSingle();
  if (data?.secret) return data.secret;
  return process.env[ENV_MAP[provider]] ?? null;
}

// ── Provedores MULTI-CAMPO (Console guarda vários valores num JSON no campo `secret`) ──
// Cada campo tem fallback para uma env. Ordem: valor gravado no Console → env.
export const PROVIDER_FIELDS: Record<string, { key: string; label: string; env: string; secret: boolean }[]> = {
  google: [
    { key: "client_id", label: "OAuth Client ID", env: "GOOGLE_OAUTH_CLIENT_ID", secret: false },
    { key: "client_secret", label: "OAuth Client Secret", env: "GOOGLE_OAUTH_CLIENT_SECRET", secret: true },
    { key: "refresh_token", label: "Refresh Token", env: "GOOGLE_OAUTH_REFRESH_TOKEN", secret: true },
    { key: "sender_email", label: "E-mail remetente (Gmail)", env: "GOOGLE_SENDER_EMAIL", secret: false },
  ],
  zapi: [
    { key: "instance_id", label: "ID da instância", env: "ZAPI_INSTANCE_ID", secret: false },
    { key: "token", label: "Token da instância", env: "ZAPI_TOKEN", secret: true },
    { key: "client_token", label: "Client-Token (opcional · Conta › Segurança)", env: "ZAPI_CLIENT_TOKEN", secret: true },
    { key: "admin_numbers", label: "Números admin (notificação, vírgula)", env: "ADMIN_WHATSAPP_NUMBERS", secret: false },
  ],
};

function parseJsonSecret(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try { const o = JSON.parse(raw); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

/** Config completa de um provedor multi-campo: cada campo = valor do Console → env. Server-only. */
export async function getProviderConfig(provider: string): Promise<Record<string, string>> {
  const fields = PROVIDER_FIELDS[provider];
  if (!fields) return {};
  const sb = createServiceClient();
  const { data } = await sb.from("integration_secrets").select("secret").eq("provider", provider).is("org_id", null).maybeSingle();
  const stored = parseJsonSecret(data?.secret);
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = stored[f.key] || process.env[f.env] || "";
    if (v) out[f.key] = v;
  }
  return out;
}

/** Quais campos de um provedor já têm valor (Console OU env) — status na UI, sem expor segredo. */
export async function getProviderFieldStatus(provider: string): Promise<Record<string, boolean>> {
  const fields = PROVIDER_FIELDS[provider];
  if (!fields) return {};
  const cfg = await getProviderConfig(provider);
  return Object.fromEntries(fields.map((f) => [f.key, !!cfg[f.key]]));
}

/** Grava/atualiza campos de um provedor multi-campo (merge; não apaga o que veio vazio). Write-only. */
export async function setProviderConfig(provider: string, values: Record<string, string>, updatedBy?: string | null): Promise<void> {
  const fields = PROVIDER_FIELDS[provider];
  if (!fields) return;
  const sb = createServiceClient();
  const { data: ex } = await sb.from("integration_secrets").select("id, secret").eq("provider", provider).is("org_id", null).maybeSingle();
  const merged = { ...parseJsonSecret(ex?.secret) };
  for (const f of fields) {
    const v = (values[f.key] ?? "").trim();
    if (v) merged[f.key] = v; // só sobrescreve com valor não-vazio
  }
  const row = { provider, scope: "global", org_id: null, secret: JSON.stringify(merged), status: "configurado", updated_by: updatedBy ?? null, updated_at: new Date().toISOString() };
  if (ex) await sb.from("integration_secrets").update(row).eq("id", ex.id);
  else await sb.from("integration_secrets").insert(row);
  await auditService("secret.save", "integration_secrets", provider, { fields: Object.keys(values) }, undefined);
}

/** Grava um segredo (write-only). Nunca lido de volta pela UI. Auditado (sem o valor). */
export async function setSecret(provider: string, value: string, updatedBy?: string | null): Promise<void> {
  const sb = createServiceClient();
  const { data: ex } = await sb.from("integration_secrets").select("id").eq("provider", provider).is("org_id", null).maybeSingle();
  const row = { provider, scope: "global", org_id: null, secret: value, status: "configurado", updated_by: updatedBy ?? null, updated_at: new Date().toISOString() };
  if (ex) await sb.from("integration_secrets").update(row).eq("id", ex.id);
  else await sb.from("integration_secrets").insert(row);
  await auditService("secret.save", "integration_secrets", provider, null, undefined);
}

/** Testa a conexão do provedor e atualiza o status. Nunca expõe o segredo. */
export async function testConnection(provider: string): Promise<{ ok: boolean; status: string }> {
  const multi = !!PROVIDER_FIELDS[provider];
  const cfg = multi ? await getProviderConfig(provider) : {};
  const key = multi ? (Object.keys(cfg).length ? "multi" : null) : await getSecret(provider);
  let ok = false;
  // diagnóstico (sem segredo): http status + trecho da resposta do provedor, para depurar sem expor a chave.
  const diag: Record<string, unknown> = {};
  if (key) {
    try {
      if (provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: 4, messages: [{ role: "user", content: "ok" }] }) });
        ok = r.ok; diag.http = r.status;
      } else if (provider === "apollo") {
        const r = await fetch("https://api.apollo.io/v1/auth/health", { headers: { "x-api-key": key } });
        const d = await r.json().catch(() => ({})); ok = !!d?.healthy; diag.http = r.status;
      } else if (provider === "google") {
        // Troca o refresh_token do Console/env por um access token — valida as 3 chaves.
        const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cfg.client_id ?? "", client_secret: cfg.client_secret ?? "", refresh_token: cfg.refresh_token ?? "", grant_type: "refresh_token" }) });
        const d = await r.json().catch(() => ({})); ok = !!d?.access_token; diag.http = r.status; diag.err = d?.error ?? d?.error_description ?? null;
      } else if (provider === "zapi") {
        // Status da instância Z-API. Client-Token só entra se existir (senão a Z-API rejeita header vazio).
        const headers: Record<string, string> = {};
        if (cfg.client_token) headers["Client-Token"] = cfg.client_token;
        const r = await fetch(`https://api.z-api.io/instances/${cfg.instance_id}/token/${cfg.token}/status`, { headers });
        const d = await r.json().catch(() => ({}));
        diag.http = r.status;
        diag.err = typeof d?.error === "string" ? d.error : (d?.error === true ? "error:true" : null);
        diag.connected = d?.connected ?? null;
        diag.smartphoneConnected = d?.smartphoneConnected ?? null;
        diag.hasClientToken = !!cfg.client_token;
        diag.keys = Object.keys(d ?? {}).slice(0, 8);
        // OK = instância conectada. A Z-API devolve error:"You are already connected." (informativo) no sucesso,
        // então NÃO tratamos `error` como falha quando connected/smartphoneConnected são true.
        ok = r.ok && (d?.connected === true || d?.smartphoneConnected === true);
      } else { ok = true; diag.note = "presença da chave = configurado"; }
    } catch (e) { ok = false; diag.exception = (e as Error).message; }
  }
  const status = key ? (ok ? "configurado" : "invalido") : "ausente";
  const sb = createServiceClient();
  const { data: ex } = await sb.from("integration_secrets").select("id").eq("provider", provider).is("org_id", null).maybeSingle();
  if (ex) await sb.from("integration_secrets").update({ status, last_tested_at: new Date().toISOString() }).eq("id", ex.id);
  else await sb.from("integration_secrets").insert({ provider, scope: "global", status, last_tested_at: new Date().toISOString() });
  await auditService("secret.test", "integration_secrets", provider, { ok, status, ...diag }, undefined);
  return { ok, status };
}
