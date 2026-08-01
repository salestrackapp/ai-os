"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOTIF_EVENTS } from "@/lib/notifications/events";
import { exigirAdmin } from "@/lib/auth";

/**
 * Grava a matriz de preferências do próprio usuário.
 * Só grava linha para o que difere do padrão do catálogo — a tabela é esparsa de propósito,
 * então mudar um padrão depois vale para quem nunca mexeu.
 */
export async function salvarPreferencias(formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");

  const manter: string[] = [];
  const upserts: { user_id: string; event: string; in_app: boolean; email: boolean; updated_at: string }[] = [];

  for (const ev of NOTIF_EVENTS) {
    const inApp = formData.get(`in_app:${ev.key}`) === "on";
    const email = formData.get(`email:${ev.key}`) === "on";
    if (inApp === ev.defaults.inApp && email === ev.defaults.email) continue; // padrão → sem linha
    manter.push(ev.key);
    upserts.push({ user_id: user.id, event: ev.key, in_app: inApp, email, updated_at: new Date().toISOString() });
  }

  if (upserts.length) {
    const { error } = await supabase.from("notification_prefs").upsert(upserts, { onConflict: "user_id,event" });
    if (error) throw new Error(error.message);
  }
  // o que voltou ao padrão perde a linha
  let del = supabase.from("notification_prefs").delete().eq("user_id", user.id);
  if (manter.length) del = del.not("event", "in", `(${manter.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/admin/configuracoes/notificacoes");
}
