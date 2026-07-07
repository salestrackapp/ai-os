import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getProviderConfig } from "@/lib/settings/secrets";
import type { CanalWhatsApp, WaResult, WaRef } from "./types";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Implementação Z-API. Config vem do Console (integration_secrets) → env. Degradado sem config. */
export class ZapiCanal implements CanalWhatsApp {
  async enviar(to: string, body: string, ref?: WaRef): Promise<WaResult> {
    const phone = onlyDigits(to);
    const cfg = await getProviderConfig("zapi");
    const instance = cfg.instance_id, token = cfg.token, clientToken = cfg.client_token;
    const configured = !!(instance && token); // Client-Token é opcional (só se a conta exigir)
    const sb = createServiceClient();
    // registra a intenção de envio (out)
    const { data: row } = await sb.from("wa_messages").insert({
      org_id: ref?.org_id ?? null, direction: "out", provider: "zapi",
      to_phone: phone, body, status: "enviando",
      ref_table: ref?.ref_table ?? null, ref_id: ref?.ref_id ?? null,
    }).select("id").single();
    const msgId = row?.id;

    if (!configured) {
      console.warn("[whatsapp] Z-API não configurada — modo degradado, mensagem não enviada.");
      if (msgId) await sb.from("wa_messages").update({ status: "erro", body: body + " [não enviado: sem config]" }).eq("id", msgId);
      return { ok: false, id: msgId, degraded: true };
    }

    try {
      const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
        body: JSON.stringify({ phone, message: body }),
      });
      const json = await res.json().catch(() => ({}));
      const providerRef = json?.messageId ?? json?.id ?? json?.zaapId ?? null;
      if (!res.ok) {
        if (msgId) await sb.from("wa_messages").update({ status: "erro" }).eq("id", msgId);
        return { ok: false, id: msgId, error: json?.error ?? `HTTP ${res.status}` };
      }
      if (msgId) await sb.from("wa_messages").update({ status: "enviado", provider_ref: providerRef }).eq("id", msgId);
      return { ok: true, id: msgId, providerRef };
    } catch (e) {
      if (msgId) await sb.from("wa_messages").update({ status: "erro" }).eq("id", msgId);
      return { ok: false, id: msgId, error: (e as Error).message };
    }
  }

  async status(providerRef: string): Promise<string> {
    const sb = createServiceClient();
    const { data } = await sb.from("wa_messages").select("status").eq("provider_ref", providerRef).limit(1).single();
    return data?.status ?? "desconhecido";
  }
}
