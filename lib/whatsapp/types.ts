// Interface neutra de canal WhatsApp — hoje Z-API, amanhã Meta Cloud (troca 1 env).
export type WaResult = { ok: boolean; id?: string; providerRef?: string; error?: string; degraded?: boolean };
export type WaRef = { ref_table?: string; ref_id?: string; org_id?: string | null };

export interface CanalWhatsApp {
  enviar(to: string, body: string, ref?: WaRef): Promise<WaResult>;
  status(providerRef: string): Promise<string>;
}
