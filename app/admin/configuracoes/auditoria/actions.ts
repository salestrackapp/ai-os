"use server";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";

/**
 * Verifica a integridade da cadeia encadeada do audit_logs.
 * Percorre em ordem de id e confere que cada prev_hash aponta para o hash
 * do registro anterior (o primeiro deve ser 'GENESIS'). Uma quebra indica
 * remoção, reordenação ou inserção fora da cadeia.
 */
export async function verifyChain(): Promise<{ ok: boolean; brokenId: number | null; total: number }> {
  await exigirAdmin();
  const supabase = await createClient();
  const rows: { id: number; prev_hash: string | null; hash: string }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("audit_logs")
      .select("id, prev_hash, hash").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  let prev = "GENESIS";
  for (const r of rows) {
    if ((r.prev_hash ?? "") !== prev) return { ok: false, brokenId: r.id, total: rows.length };
    prev = r.hash;
  }
  return { ok: true, brokenId: null, total: rows.length };
}
