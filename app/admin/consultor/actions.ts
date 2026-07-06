"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentMembership } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendToContact } from "@/lib/whatsapp";
import { postSlackMessage } from "@/lib/slack";

/** Admin assume a conversa e responde manualmente (mensagem marcada como humana). Entrega no canal quando possível. */
export async function postAdminReply(conversationId: string, formData: FormData) {
  const m = await currentMembership();
  if (!m?.isSalestrackAdmin) throw new Error("Sem permissão.");
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  const svc = createServiceClient();
  const { data: conv } = await svc.from("conversations").select("org_id, canal").eq("id", conversationId).single();
  if (!conv) throw new Error("Conversa não encontrada.");

  await svc.from("messages").insert({ conversation_id: conversationId, org_id: conv.org_id, role: "assistant", content, autor: "humano" });

  // Entrega no canal externo (best-effort)
  if (conv.canal === "whatsapp") {
    const { data: c } = await svc.from("contacts").select("phone, opt_in_whatsapp").eq("org_id", conv.org_id).eq("opt_in_whatsapp", true).not("phone", "is", null).limit(1).maybeSingle();
    if (c?.phone) await sendToContact({ phone: c.phone, optIn: true, body: content, orgId: conv.org_id });
  } else if (conv.canal === "slack") {
    const { data: map } = await svc.from("app_settings").select("value").eq("key", "slack_channels").maybeSingle();
    const entry = Object.entries((map?.value as Record<string, string> | null) ?? {}).find(([, org]) => org === conv.org_id);
    if (entry) await postSlackMessage(entry[0], content);
  }

  await audit("consultor.admin_reply", "messages", conversationId, { canal: conv.canal }, conv.org_id);
  revalidatePath(`/admin/consultor/${conversationId}`);
}
