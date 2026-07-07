/** Relacionamento (E0) — modelo channel-agnostic da inbox compartilhada. Lógica pura (testável). */

export type Channel = "email" | "whatsapp";
export type ConvStatus = "aberta" | "aguardando" | "respondida" | "arquivada";
export type Direction = "in" | "out";
export type InboxFilter = "minhas" | "nao_atribuidas" | "todas";
export type NotifTipo = "nova_conversa" | "nova_mensagem" | "atribuicao" | "followup_vencido" | "aprovacao";

export const CHANNEL_LABELS: Record<Channel, string> = { email: "E-mail", whatsapp: "WhatsApp" };
export const STATUS_LABELS: Record<ConvStatus, string> = {
  aberta: "Aberta", aguardando: "Aguardando", respondida: "Respondida", arquivada: "Arquivada",
};
export const FILTER_LABELS: Record<InboxFilter, string> = {
  minhas: "Minhas", nao_atribuidas: "Não atribuídas", todas: "Todas",
};

export type RelConversa = {
  id: string; org_id: string; channel: Channel; external_ref: string | null;
  assunto: string | null; contato_nome: string | null; contato_email: string | null; contato_phone: string | null;
  status: ConvStatus; assigned_to: string | null; snooze_until: string | null;
  client_id: string | null; deal_id: string | null; contact_id: string | null;
  unread: boolean; last_message_at: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};

export type RelMensagem = {
  id: string; conversa_id: string; direction: Direction; corpo: string | null;
  media: unknown[]; status_entrega: string | null; provider_ref: string | null; external_ref: string | null;
  sent_by: string | null; created_at: string;
};

/** Uma conversa casa com o filtro da inbox de equipe? (puro) */
export function matchesFilter(conv: Pick<RelConversa, "assigned_to">, filter: InboxFilter, userId: string): boolean {
  if (filter === "todas") return true;
  if (filter === "minhas") return conv.assigned_to === userId;
  return conv.assigned_to === null; // nao_atribuidas
}

/** Está "adormecida" (snooze) neste instante? (puro) — usa um now injetável p/ ser testável. */
export function isSnoozed(conv: Pick<RelConversa, "snooze_until">, nowISO: string): boolean {
  return !!conv.snooze_until && conv.snooze_until > nowISO;
}

/** Follow-up venceu? snooze no passado + ainda aberta/aguardando. (puro) */
export function isFollowupDue(conv: Pick<RelConversa, "snooze_until" | "status">, nowISO: string): boolean {
  if (!conv.snooze_until) return false;
  if (!["aberta", "aguardando"].includes(conv.status)) return false;
  return conv.snooze_until <= nowISO;
}

/** Fecha da janela de 24h do WhatsApp a partir da última msg recebida. null se nunca recebeu. (puro) */
export function waWindowClosesAt(lastInboundISO: string | null): string | null {
  if (!lastInboundISO) return null;
  const t = new Date(lastInboundISO).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + 24 * 3600 * 1000).toISOString();
}

/** Janela de 24h aberta? (puro) — envio livre só dentro; fora exige template HSM (regra no E4). */
export function isWaWindowOpen(lastInboundISO: string | null, nowISO: string): boolean {
  const closes = waWindowClosesAt(lastInboundISO);
  return !!closes && closes > nowISO;
}

/** Regra de envio do WhatsApp (puro): consentimento obrigatório; dentro de 24h texto livre; fora → só HSM. */
export function canSendWhatsApp(opts: { optIn: boolean; windowOpen: boolean; isHsm: boolean }): { ok: boolean; motivo?: string } {
  if (!opts.optIn) return { ok: false, motivo: "Contato sem consentimento (opt-in) — não é permitido enviar." };
  if (opts.windowOpen) return { ok: true };
  if (opts.isHsm) return { ok: true };
  return { ok: false, motivo: "Fora da janela de 24h — só é possível enviar um template HSM aprovado." };
}

/** Transição de status permitida? (puro) — arquivada é terminal (só reabre para 'aberta'). */
export function canTransition(from: ConvStatus, to: ConvStatus): boolean {
  if (from === to) return false;
  if (from === "arquivada") return to === "aberta";
  return true;
}
