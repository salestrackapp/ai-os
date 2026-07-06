import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { findSetting } from "./registry";

// Chave de armazenamento: org-scoped é namespaceada (preserva o unique(key) existente do app_settings).
function storeKey(key: string, orgId?: string | null): string { return orgId ? `${key}#org:${orgId}` : key; }

/** Precedência: app_settings → env → default do registro. */
export async function getSetting<T = unknown>(key: string, orgId?: string | null): Promise<T> {
  const def = findSetting(key);
  const sb = createServiceClient();
  // org-scoped primeiro, depois global
  if (orgId) {
    const { data } = await sb.from("app_settings").select("value").eq("key", storeKey(key, orgId)).maybeSingle();
    if (data && data.value !== null && data.value !== undefined) return data.value as T;
  }
  const { data: g } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (g && g.value !== null && g.value !== undefined) return g.value as T;
  if (def?.env && process.env[def.env] != null && process.env[def.env] !== "") return process.env[def.env] as unknown as T;
  return (def?.default ?? null) as T;
}

/** Fonte efetiva de um setting (para o Console). */
export async function getSettingSource(key: string, orgId?: string | null): Promise<{ value: unknown; source: "app" | "env" | "default" }> {
  const def = findSetting(key);
  const sb = createServiceClient();
  if (orgId) { const { data } = await sb.from("app_settings").select("value").eq("key", storeKey(key, orgId)).maybeSingle(); if (data) return { value: data.value, source: "app" }; }
  const { data: g } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (g) return { value: g.value, source: "app" };
  if (def?.env && process.env[def.env] != null && process.env[def.env] !== "") return { value: process.env[def.env], source: "env" };
  return { value: def?.default ?? null, source: "default" };
}

/** Grava um setting (namespaceado se org). Auditado. */
export async function setSettingValue(key: string, value: unknown, opts?: { orgId?: string | null; category?: string; updatedBy?: string | null }): Promise<void> {
  const sb = createServiceClient();
  await sb.from("app_settings").upsert(
    { key: storeKey(key, opts?.orgId), value, scope: opts?.orgId ? "org" : "global", org_id: opts?.orgId ?? null, category: opts?.category ?? findSetting(key)?.category ?? null, updated_by: opts?.updatedBy ?? null, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  await auditService("setting.save", "app_settings", key, { orgId: opts?.orgId ?? null }, opts?.orgId ?? undefined);
}

// atalhos tipados usados pelos módulos
export async function getNumber(key: string, orgId?: string | null): Promise<number | null> { const v = await getSetting(key, orgId); const n = Number(v); return Number.isFinite(n) ? n : null; }
export async function getString(key: string, orgId?: string | null): Promise<string | null> { const v = await getSetting(key, orgId); return v == null ? null : String(v); }
