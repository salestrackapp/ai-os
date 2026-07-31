import "server-only";
import { notifyMany, salestrackAdminIds } from "./notify";

/**
 * Os avisos da equipe, um por momento que importa.
 *
 * ── O que estava errado ───────────────────────────────────────────────────────────────────────
 * O catálogo tem dez eventos e a tela de preferências oferece um interruptor para cada um. Cinco
 * nunca disparavam — proposta lida, contrato assinado, prospect respondeu, sessão agendada,
 * mensagem recebida — justamente os cinco de maior sinal. Um interruptor para um aviso que não
 * existe é pior do que não ter o interruptor: quem liga passa a confiar que vai ser avisado.
 *
 * ── Por que ficam aqui, e não soltos nos pontos de código ─────────────────────────────────────
 * Cada um destes é chamado de um lugar diferente — página pública, webhook, server action, cron. Se
 * o formato do aviso morasse em cada um deles, o texto divergiria com o tempo e ninguém saberia
 * qual é o certo. Aqui, o ponto de código só diz O QUE aconteceu; como isso vira aviso é decidido
 * uma vez só.
 *
 * ── Nunca lançam ──────────────────────────────────────────────────────────────────────────────
 * `notify` já engole falha e registra no log. Estas funções herdam isso: um aviso que não sai não
 * pode impedir um contrato de ser assinado nem uma proposta de ser lida.
 */

/** Todos estes avisos são da EQUIPE, não de um cliente — daí o mesmo destinatário nos cinco. */
async function paraEquipe(base: {
  event: string; title: string; body?: string | null; url?: string | null;
  entityType?: string | null; entityId?: string | null; orgId?: string | null;
}): Promise<void> {
  const ids = await salestrackAdminIds();
  if (!ids.length) return;
  await notifyMany(ids, base);
}

/** O cliente abriu a proposta. É a hora de ligar — e até aqui só ia para o WhatsApp, que está mudo. */
export async function avisarPropostaLida(p: {
  propostaId: string; titulo: string; cliente: string | null; orgId?: string | null;
}): Promise<void> {
  await paraEquipe({
    event: "proposal_read",
    title: `${p.cliente ?? "O cliente"} abriu a proposta`,
    body: `"${p.titulo}" foi aberta agora, pela primeira vez.`,
    url: `/admin/propostas/${p.propostaId}`,
    entityType: "proposal", entityId: p.propostaId, orgId: p.orgId ?? null,
  });
}

export async function avisarContratoAssinado(c: {
  contratoId: string; signatario: string | null; orgId?: string | null;
}): Promise<void> {
  await paraEquipe({
    event: "contract_signed",
    title: "Contrato assinado",
    body: `${c.signatario ?? "O cliente"} concluiu a assinatura no Docusign. O kickoff começa a partir daqui.`,
    url: `/admin/contratos/${c.contratoId}`,
    entityType: "contract", entityId: c.contratoId, orgId: c.orgId ?? null,
  });
}

/** Resposta de prospecção — o sinal mais forte antes de uma reunião marcada. */
export async function avisarProspectRespondeu(p: {
  prospectId: string; nome: string | null; classificacao: string; trecho: string;
}): Promise<void> {
  await paraEquipe({
    event: "prospect_replied",
    title: `${p.nome ?? "Um prospect"} respondeu · ${p.classificacao}`,
    body: p.trecho.slice(0, 200),
    url: `/admin/prospeccao/${p.prospectId}`,
    entityType: "prospect", entityId: p.prospectId,
  });
}

export async function avisarSessaoAgendada(s: {
  sessaoId: string | null; titulo: string; quando: string | null; cliente: string | null; orgId?: string | null;
}): Promise<void> {
  await paraEquipe({
    event: "session_scheduled",
    title: `Sessão agendada${s.cliente ? ` · ${s.cliente}` : ""}`,
    body: `${s.titulo}${s.quando ? ` — ${new Date(s.quando).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`,
    url: "/admin/sessoes",
    entityType: "session", entityId: s.sessaoId, orgId: s.orgId ?? null,
  });
}

/**
 * Mensagem que precisa de gente.
 *
 * Chamado DEPOIS da triagem, nunca a cada mensagem que entra. Sem essa ordem, o aviso dispararia
 * para relatório DMARC e newsletter — 200 notificações que ensinam a ignorar a próxima.
 */
export async function avisarMensagemQuePrecisaDeVoce(m: {
  conversaId: string; contato: string | null; assunto: string | null; canal: string;
}): Promise<void> {
  await paraEquipe({
    event: "message_received",
    title: `${m.contato ?? "Alguém"} espera resposta`,
    body: m.assunto ?? `Nova mensagem no ${m.canal === "whatsapp" ? "WhatsApp" : "e-mail"}.`,
    url: `/admin/relacionamento/${m.conversaId}`,
    entityType: "rel_conversa", entityId: m.conversaId,
  });
}
