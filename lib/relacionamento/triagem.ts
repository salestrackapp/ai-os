import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgentCore, anthropicConfigured } from "@/lib/agents/runner";
import { avisarMensagemQuePrecisaDeVoce } from "@/lib/notifications/eventos";

/**
 * Triagem da caixa: o que espera resposta de uma pessoa, e o que é máquina falando.
 *
 * ── Por que isto existe ───────────────────────────────────────────────────────────────────────
 * A caixa tem mais de 200 conversas abertas e quase todo o volume é ferramenta avisando alguma
 * coisa: Google, Vercel, Supabase, Docusign, registro.br, relatório DMARC, newsletter. Numa lista
 * onde tudo tem o mesmo peso, o e-mail do cliente fica no meio de trinta avisos de cobrança de
 * domínio — e a caixa deixa de ser lida. Foi o que aconteceu.
 *
 * ── Duas camadas, nessa ordem, e o motivo ─────────────────────────────────────────────────────
 * 1. REMETENTE (grátis): `noreply@`, `mail.`, `beehiiv`, o nosso próprio endereço. Não precisa de
 *    IA para saber que ninguém responde a um relatório DMARC. Corta a maior parte por dez linhas
 *    de regex, e o que a regex corta é auditável — dá para discordar e ajustar.
 * 2. ASSUNTO + PRIMEIRAS LINHAS (IA barata): o que sobrou. Aqui a pergunta é de julgamento —
 *    prospecção fria e cliente pedindo prazo chegam do mesmo tipo de endereço.
 *
 * A ordem importa por dinheiro e por confiança: o que é decidível sem IA não deve custar nem
 * depender dela. Sem `ANTHROPIC_API_KEY`, a camada 1 continua funcionando sozinha.
 */

export type Categoria = "precisa_resposta" | "informativo" | "promocional" | "automatico";

export const CATEGORIA_ROTULO: Record<Categoria, string> = {
  precisa_resposta: "Precisa de você",
  informativo: "Só informa",
  promocional: "Promoção / prospecção",
  automatico: "Máquina",
};

/**
 * Caixa-postal que não lê resposta. Se você responder, ou volta bounce ou cai num vácuo.
 * `alert` e `security` entram aqui de propósito: importam para ler, nunca para responder.
 */
// O separador inclui `+` por causa do sub-endereçamento (`invoice+statements@`), que é justamente
// como as ferramentas de cobrança escrevem. Sem ele, o caso mais comum escapava.
const LOCAL_MAQUINA = /(^|[.\-_+])(no-?reply|noreply|do-?not-?reply|nao-?responda|não-?responda|notifica(cao|ção)?|notification|mailer|mail-?daemon|bounce|postmaster|automated|dmarcreport|alert|newsletter|news|update|billing|invoice|security|dse_[a-z0-9]+)s?([.\-_+]|$)/i;

/** Subdomínio de disparo em massa. Ninguém escreve pessoalmente de `mkt.` ou `news.`. */
const SUBDOMINIO_ENVIO = /^(mail|email|em|news|newsletter|mkt|marketing|e|send|smtp|reply|notification|notifications|alert|alerts|go|link|click|track)\./i;

/** Plataforma de e-mail em massa: o domínio já entrega o veredito. */
const PLATAFORMA_ENVIO = /(beehiiv|mailerlite|substack|mailchimp|mandrill|sendgrid|sparkpost|amazonses|rdstation|activecampaign|klaviyo|braze|customer\.io|mailgun)/i;

/** Nosso próprio endereço: é o sistema avisando a gente, ou nós mesmos em cópia. */
const NOSSO_DOMINIO = /@(salestrack\.com\.br|andrekachan\.com\.br)$/i;

/**
 * Aviso do calendário, não mensagem de gente.
 *
 * Achado na primeira rodada real: de 10 conversas marcadas "precisa de você", 5 eram
 * "Aceito: Reunião…" — o Google avisando que alguém clicou em aceitar. O classificador acertou ao
 * hesitar (o remetente É uma pessoa), mas ninguém responde a um aceite de convite. Como o prefixo é
 * gerado pelo próprio calendário, isto é decidível sem IA — e sem custo.
 *
 * Só casa no COMEÇO do assunto: "Re: Convite…" é alguém escrevendo de volta, e aí é conversa.
 */
const ASSUNTO_CALENDARIO = /^(aceito|aceita|accepted|recusado|recusada|declined|tentative|provisório|provisorio|cancelado|canceled|cancelled|convite|invitation|updated invitation|convite atualizado)\s*:/i;

export type Veredito = { categoria: Categoria; motivo: string };

/**
 * Camada 1. Devolve `null` quando não consegue decidir sozinha — e não decidir é a resposta certa
 * na maior parte dos casos interessantes.
 */
export function triarPeloRemetente(email: string | null, assunto?: string | null): Veredito | null {
  if (ASSUNTO_CALENDARIO.test((assunto ?? "").trim())) {
    return { categoria: "informativo", motivo: "Aviso do calendário sobre um convite — não espera resposta." };
  }

  const e = (email ?? "").trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  const [local, dominio] = [e.split("@")[0], e.split("@").slice(1).join("@")];

  if (NOSSO_DOMINIO.test(e)) return { categoria: "automatico", motivo: "É o nosso próprio endereço — o sistema avisando a equipe." };
  if (LOCAL_MAQUINA.test(local)) return { categoria: "automatico", motivo: `Caixa que não lê resposta (${local}@).` };
  if (SUBDOMINIO_ENVIO.test(dominio)) return { categoria: "promocional", motivo: `Enviado por subdomínio de disparo em massa (${dominio}).` };
  if (PLATAFORMA_ENVIO.test(dominio)) return { categoria: "promocional", motivo: "Enviado por plataforma de newsletter." };
  return null;
}

const REGRAS_IA = `
Você classifica e-mails de uma caixa corporativa da Salestrack AI — consultoria que implanta IA na
operação de empresas: vendas, marketing, operações, atendimento, backoffice (financeiro, RH,
jurídico), governança de IA, além de formação de times, mentoria executiva e palestras.
Responda com UMA palavra, exatamente uma destas quatro, e nada mais:

precisa_resposta — uma pessoa escreveu esperando retorno nosso: cliente, prospect que respondeu,
  parceiro, fornecedor cobrando algo, convite de reunião, dúvida, negociação.
informativo — comunicação real, mas que não pede resposta: recibo, aviso de sistema, confirmação,
  relatório, atualização de serviço, contrato assinado.
promocional — venda fria, marketing, newsletter, convite de evento, "conheça nossa solução".
automatico — mensagem gerada por robô sem remetente humano por trás.

Na dúvida entre precisa_resposta e as outras, escolha precisa_resposta: deixar de ver um e-mail de
cliente custa muito mais caro do que olhar um a mais.`;

/**
 * Camada 2. Só o que a camada 1 não decidiu.
 *
 * Manda assunto + começo do corpo, não o e-mail inteiro: para saber se alguém espera resposta, as
 * primeiras linhas bastam — e o resto seria contexto de cliente saindo de casa sem precisar.
 */
async function triarPelaIA(dados: { assunto: string | null; remetente: string | null; trecho: string }): Promise<Veredito | null> {
  if (!anthropicConfigured()) return null;
  const r = await runAgentCore({
    agentKey: "triagem_caixa",
    guardrails: REGRAS_IA,
    // Classificação de três opções não justifica o modelo que redige proposta.
    modelo: "claude-haiku-4-5-20251001",
    userMessages: [{
      role: "user",
      content: `De: ${dados.remetente ?? "(desconhecido)"}\nAssunto: ${dados.assunto ?? "(sem assunto)"}\n\n${dados.trecho.slice(0, 1200)}`,
    }],
    maxTokens: 12,
  });
  if (r.degraded) return null;

  const palavra = r.text.trim().toLowerCase().replace(/[^a-z_]/g, "");
  const validas: Categoria[] = ["precisa_resposta", "informativo", "promocional", "automatico"];
  const cat = validas.find((v) => palavra === v);
  if (!cat) return null;   // resposta fora do vocabulário: melhor ficar sem triagem do que errado
  return { categoria: cat, motivo: "Classificado pelo conteúdo do e-mail." };
}

/**
 * Tria as conversas ainda não olhadas. Devolve o que fez, para a tela poder dizer.
 *
 * O teto existe porque a camada 2 custa por conversa: uma caixa que recebe 300 e-mails num dia não
 * pode virar 300 chamadas de IA sem ninguém ter decidido isso.
 */
export async function triarPendentes(max = 30): Promise<{ olhadas: number; porIA: number; precisamDeVoce: number }> {
  const sb = createServiceClient();
  const { data: convs } = await sb.from("rel_conversas")
    .select("id, contato_email, contato_nome, assunto, channel")
    .is("triagem", null).is("deleted_at", null)
    .order("last_message_at", { ascending: false }).limit(max);

  let olhadas = 0, porIA = 0, precisamDeVoce = 0;
  for (const c of convs ?? []) {
    /**
     * WhatsApp não passa por triagem: ninguém monta campanha de newsletter no WhatsApp de alguém, e
     * uma mensagem que chega ali é de uma pessoa até prova em contrário. Classificar seria pagar
     * para descobrir o que já se sabe.
     */
    let v: Veredito | null = c.channel === "whatsapp"
      ? { categoria: "precisa_resposta", motivo: "Mensagem de WhatsApp — sempre de uma pessoa." }
      : triarPeloRemetente(c.contato_email as string | null, c.assunto as string | null);

    if (!v) {
      const { data: ms } = await sb.from("rel_mensagens")
        .select("corpo").eq("conversa_id", c.id).eq("direction", "in")
        .order("created_at", { ascending: false }).limit(1);
      v = await triarPelaIA({
        assunto: c.assunto as string | null,
        remetente: c.contato_email as string | null,
        trecho: String(ms?.[0]?.corpo ?? ""),
      });
      if (v) porIA++;
    }
    if (!v) continue;   // sem veredito: fica na fila, e a próxima rodada tenta de novo

    await sb.from("rel_conversas").update({
      triagem: v.categoria, triagem_motivo: v.motivo, triagem_em: new Date().toISOString(),
    }).eq("id", c.id);
    olhadas++;

    /**
     * O aviso de "alguém espera resposta" nasce AQUI, e não na chegada da mensagem.
     *
     * Se disparasse a cada mensagem que entra, seriam duzentas notificações de relatório DMARC e
     * newsletter — e o efeito de duzentas notificações inúteis é ensinar a pessoa a ignorar a
     * ducentésima primeira, que era a do cliente. Avisar só depois de saber que é gente é o que
     * torna o aviso digno de confiança.
     */
    if (v.categoria === "precisa_resposta") {
      precisamDeVoce++;
      await avisarMensagemQuePrecisaDeVoce({
        conversaId: c.id as string,
        contato: (c.contato_nome as string | null) ?? (c.contato_email as string | null),
        assunto: c.assunto as string | null,
        canal: c.channel as string,
      });
    }
  }
  return { olhadas, porIA, precisamDeVoce };
}

/** Quantas conversas há em cada categoria — os números das abas da caixa. */
export async function contagemPorTriagem(): Promise<Record<string, number>> {
  const sb = createServiceClient();
  const { data } = await sb.from("rel_conversas")
    .select("triagem").is("deleted_at", null).neq("status", "arquivada");
  const c: Record<string, number> = { sem_triagem: 0 };
  for (const r of data ?? []) {
    const k = (r.triagem as string | null) ?? "sem_triagem";
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
}

/** Corrige à mão o que a triagem errou. É a válvula que impede a classificação de virar dogma. */
export async function reclassificar(conversaId: string, categoria: Categoria, quem: string): Promise<void> {
  const sb = createServiceClient();
  await sb.from("rel_conversas").update({
    triagem: categoria,
    triagem_motivo: "Corrigido à mão pela equipe.",
    triagem_em: new Date().toISOString(),
  }).eq("id", conversaId);
  const { auditService } = await import("@/lib/audit");
  await auditService("rel.triagem_corrigida", "rel_conversas", conversaId, { categoria, por: quem });
}
