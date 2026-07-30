// Catálogo de eventos de notificação + canais padrão por evento.
// Dado puro: sem import de servidor, para poder ser usado também no cliente (matriz de preferências).

export type NotifChannels = { inApp: boolean; email: boolean };

export type NotifEventDef = {
  key: string;
  label: string;
  descricao: string;
  defaults: NotifChannels;
};

export const NOTIF_EVENTS: NotifEventDef[] = [
  { key: "deal_won", label: "Negócio ganho", descricao: "Um negócio chegou ao estágio cliente.", defaults: { inApp: true, email: true } },
  { key: "deal_lost", label: "Negócio perdido", descricao: "Um negócio foi marcado como perdido, com motivo.", defaults: { inApp: true, email: false } },
  { key: "new_lead", label: "Novo lead", descricao: "Entrou um lead pelos sites ou pela importação.", defaults: { inApp: true, email: false } },
  { key: "proposal_read", label: "Proposta lida", descricao: "O cliente abriu uma proposta enviada.", defaults: { inApp: true, email: true } },
  { key: "contract_signed", label: "Contrato assinado", descricao: "Assinatura concluída no DocuSign.", defaults: { inApp: true, email: true } },
  { key: "task_due_soon", label: "Tarefa vencendo", descricao: "Tarefa vence hoje ou amanhã.", defaults: { inApp: true, email: false } },
  { key: "task_overdue", label: "Tarefa atrasada", descricao: "Tarefa passou do prazo e segue aberta.", defaults: { inApp: true, email: true } },
  { key: "prospect_replied", label: "Prospect respondeu", descricao: "Resposta registrada numa cadência de prospecção.", defaults: { inApp: true, email: true } },
  { key: "session_scheduled", label: "Sessão agendada", descricao: "Nova sessão marcada via Calendly.", defaults: { inApp: true, email: true } },
  { key: "message_received", label: "Mensagem recebida", descricao: "Mensagem nova na caixa de relacionamento.", defaults: { inApp: true, email: false } },
];

export const EVENT_LABEL: Record<string, string> = Object.fromEntries(NOTIF_EVENTS.map((e) => [e.key, e.label]));

export function eventDefaults(key: string): NotifChannels {
  return NOTIF_EVENTS.find((e) => e.key === key)?.defaults ?? { inApp: true, email: false };
}
