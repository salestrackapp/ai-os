import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { CanalWhatsApp, WaResult, WaRef } from "./types";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Implementação Z-API. Modo degradado quando as envs não estão configuradas. */
export class ZapiCanal implements CanalWhatsApp {
  private instance = process.env.ZAPI_INSTANCE_ID;
  private token = process.env.ZAPI_TOKEN;
  private clientToken = process.env.ZAPI_CLIENT_TOKEN;

  private configured() { return !!(this.instance && this.token && this.clientToken); }

  async enviar(to: string, body: string, ref?: WaRef): Promise<WaResult> {
    const phone = onlyDigits(to);
    const sb = createServiceClient();
    // registra a intenção de envio (out)
    const { data: row } = await sb.from("wa_messages").insert({
      org_id: ref?.org_id ?? null, direction: "out", provider: "zapi",
      to_phone: phone, body, status: "enviando",
      ref_table: ref?.ref_table ?? null, ref_id: ref?.ref_id ?? null,
    }).select("id").single();
    const msgId = row?.id;

    if (!this.configured()) {
      console.warn("[whatsapp] Z-API não configurada — modo degradado, mensagem não enviada.");
      if (msgId) await sb.from("wa_messages").update({ status: "erro", body: body + " [não enviado: sem config]" }).eq("id", msgId);
      return { ok: false, id: msgId, degraded: true };
    }

    try {
      const url = `https://api.z-api.io/instances/${this.instance}/token/${this.token}/send-text`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": this.clientToken! },
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
