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
  const key = await getSecret(provider);
  let ok = false;
  if (key) {
    try {
      if (provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: 4, messages: [{ role: "user", content: "ok" }] }) });
        ok = r.ok;
      } else if (provider === "apollo") {
        const r = await fetch("https://api.apollo.io/v1/auth/health", { headers: { "x-api-key": key } });
        const d = await r.json().catch(() => ({})); ok = !!d?.healthy;
      } else if (provider === "google") {
        const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "", refresh_token: key, grant_type: "refresh_token" }) });
        const d = await r.json().catch(() => ({})); ok = !!d?.access_token;
      } else ok = true; // demais: presença da chave = configurado
    } catch { ok = false; }
  }
  const status = key ? (ok ? "configurado" : "invalido") : "ausente";
  const sb = createServiceClient();
  const { data: ex } = await sb.from("integration_secrets").select("id").eq("provider", provider).is("org_id", null).maybeSingle();
  if (ex) await sb.from("integration_secrets").update({ status, last_tested_at: new Date().toISOString() }).eq("id", ex.id);
  else await sb.from("integration_secrets").insert({ provider, scope: "global", status, last_tested_at: new Date().toISOString() });
  await auditService("secret.test", "integration_secrets", provider, { ok, status }, undefined);
  return { ok, status };
}
