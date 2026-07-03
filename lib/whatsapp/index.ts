import "server-only";
import { ZapiCanal } from "./zapi";
import type { CanalWhatsApp, WaRef } from "./types";
import { auditService } from "@/lib/audit";

/** Factory: escolhe o provedor pela env WHATSAPP_PROVIDER (default zapi). Pronto p/ meta_cloud. */
export function canalWhatsApp(): CanalWhatsApp {
  const provider = process.env.WHATSAPP_PROVIDER ?? "zapi";
  switch (provider) {
    // case "meta_cloud": return new MetaCloudCanal();  // Fase 6
    case "zapi":
    default:
      return new ZapiCanal();
  }
}

/** Notifica os números admin (env ADMIN_WHATSAPP_NUMBERS). Isentos de opt-in. Degradado sem envs. */
export async function notifyAdmin(body: string, ref?: WaRef): Promise<void> {
  const nums = (process.env.ADMIN_WHATSAPP_NUMBERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (nums.length === 0) { console.warn("[whatsapp] ADMIN_WHATSAPP_NUMBERS não configurado — notificação de admin ignorada."); return; }
  const canal = canalWhatsApp();
  for (const n of nums) { try { await canal.enviar(n, body, ref); } catch { /* nunca quebra o fluxo */ } }
}

/**
 * Envia a um contato de cliente. REGRA INEGOCIÁVEL: exige opt-in.
 * Sem opt-in → registra bloqueio em auditoria e NÃO envia.
 */
export async function sendToContact(
  opts: { phone: string | null; optIn: boolean; body: string; orgId?: string | null; ref?: WaRef }
): Promise<{ sent: boolean; blocked?: boolean }> {
  if (!opts.phone) return { sent: false };
  if (!opts.optIn) {
    await auditService("whatsapp.blocked_no_optin", "wa_messages", undefined, { to: opts.phone, body: opts.body }, opts.orgId ?? undefined);
    console.warn("[whatsapp] envio bloqueado — contato sem opt-in.");
    return { sent: false, blocked: true };
  }
  const canal = canalWhatsApp();
  const r = await canal.enviar(opts.phone, opts.body, { ...opts.ref, org_id: opts.orgId ?? null });
  return { sent: r.ok };
}
