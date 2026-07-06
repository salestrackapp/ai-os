"use server";
import { revalidatePath } from "next/cache";
import { currentMembership } from "@/lib/auth";
import { setSettingValue } from "@/lib/settings/resolve";
import { findSetting } from "@/lib/settings/registry";
import { setSecret, testConnection, setProviderConfig, PROVIDER_FIELDS } from "@/lib/settings/secrets";

async function requireAdmin() {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Apenas admin Salestrack.");
  return m;
}

export async function saveSetting(key: string, formData: FormData) {
  const m = await requireAdmin();
  const def = findSetting(key);
  const raw = String(formData.get("value") ?? "");
  let value: unknown = raw;
  if (def?.type === "number") value = raw.trim() === "" ? null : Number(raw);
  else if (def?.type === "bool") value = formData.get("value") === "on";
  else if (def?.type === "json") { try { value = raw.trim() ? JSON.parse(raw) : null; } catch { throw new Error("JSON inválido."); } }
  else value = raw.trim() === "" ? null : raw;
  await setSettingValue(key, value, { category: def?.category, updatedBy: m.userId });
  revalidatePath("/admin/configuracoes/parametros");
}

export async function saveSecretAction(provider: string, formData: FormData) {
  const m = await requireAdmin();
  const value = String(formData.get("secret") ?? "").trim();
  if (!value) throw new Error("Informe o segredo.");
  await setSecret(provider, value, m.userId);
  revalidatePath("/admin/configuracoes/parametros");
}

/** Salva vários campos de um provedor (Google, Z-API) de uma vez. Só grava campos preenchidos. */
export async function saveProviderConfigAction(provider: string, formData: FormData) {
  const m = await requireAdmin();
  const fields = PROVIDER_FIELDS[provider];
  if (!fields) throw new Error("Provedor sem campos.");
  const values: Record<string, string> = {};
  for (const f of fields) values[f.key] = String(formData.get(f.key) ?? "");
  await setProviderConfig(provider, values, m.userId);
  revalidatePath("/admin/configuracoes/parametros");
}

export async function testSecretAction(provider: string) {
  await requireAdmin();
  await testConnection(provider);
  revalidatePath("/admin/configuracoes/parametros");
}
