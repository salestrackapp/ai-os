import "server-only";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { eventDefaults, type NotifChannels } from "./events";

export type NotifyInput = {
  userId: string;
  event: string;
  title: string;
  body?: string | null;
  url?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  orgId?: string | null;
};

/** Preferência do usuário para o evento; linha ausente = padrão do catálogo. */
async function channelsFor(userId: string, event: string): Promise<NotifChannels> {
  const sb = createServiceClient();
  const { data } = await sb.from("notification_prefs")
    .select("in_app, email").eq("user_id", userId).eq("event", event).maybeSingle();
  if (!data) return eventDefaults(event);
  return { inApp: data.in_app, email: data.email };
}

async function emailDoUsuario(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch (e) {
    console.warn("[notify] não consegui resolver o e-mail do usuário:", (e as Error).message);
    return null;
  }
}

const APP = process.env.NEXT_PUBLIC_SITE_URL ?? "";

/**
 * Notifica UM usuário respeitando as preferências dele.
 *
 * Nunca lança: uma notificação não pode derrubar a operação que a disparou. Mas — ao contrário
 * da versão de origem — toda falha é registrada no log. Falha silenciosa aqui significa e-mail
 * que ninguém recebeu e ninguém ficou sabendo.
 *
 * O e-mail sai por after(), depois da resposta: um Resend lento não pode segurar o salvamento
 * de um negócio.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const ch = await channelsFor(input.userId, input.event);
    if (!ch.inApp && !ch.email) return;

    if (ch.inApp) {
      const sb = createServiceClient();
      const { error } = await sb.from("notifications").insert({
        user_id: input.userId,
        org_id: input.orgId ?? null,
        event: input.event,
        title: input.title,
        body: input.body ?? null,
        url: input.url ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        actor_id: input.actorId ?? null,
      });
      if (error) console.warn("[notify] falha ao gravar notificação in-app:", error.message);
    }

    if (ch.email) {
      after(async () => {
        try {
          const to = await emailDoUsuario(input.userId);
          if (!to) { console.warn(`[notify] evento ${input.event}: usuário ${input.userId} sem e-mail; nada enviado.`); return; }
          const r = await sendEmail({
            to,
            subject: input.title,
            title: input.title,
            bodyHtml: `<p>${input.body ?? ""}</p>`,
            cta: input.url ? { label: "Abrir no AI OS", url: `${APP}${input.url}` } : undefined,
          });
          if (!r.ok) console.warn(`[notify] evento ${input.event}: e-mail não entregue${r.degraded ? " (Resend não configurado)" : ""}.`);
        } catch (e) {
          console.warn("[notify] erro no envio de e-mail:", (e as Error).message);
        }
      });
    }
  } catch (e) {
    console.warn("[notify] erro geral (a operação de origem seguiu normalmente):", (e as Error).message);
  }
}

/** Mesma notificação para vários destinatários. */
export async function notifyMany(userIds: string[], base: Omit<NotifyInput, "userId">): Promise<void> {
  await Promise.all([...new Set(userIds)].filter(Boolean).map((userId) => notify({ ...base, userId })));
}

/** Ids dos admins Salestrack — para avisos que são da equipe, não de uma pessoa. */
export async function salestrackAdminIds(): Promise<string[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("memberships")
      .select("user_id, organizations!inner(is_salestrack)")
      .eq("role", "salestrack_admin");
    return (data ?? [])
      .filter((m) => (m.organizations as unknown as { is_salestrack: boolean } | null)?.is_salestrack)
      .map((m) => m.user_id as string);
  } catch (e) {
    console.warn("[notify] não consegui listar admins:", (e as Error).message);
    return [];
  }
}
