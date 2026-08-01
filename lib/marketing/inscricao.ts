import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

/**
 * Inscrição na newsletter, com dupla confirmação.
 *
 * ── O clique é que cria o consentimento ───────────────────────────────────────────────────────
 * Enviar o formulário só guarda uma intenção. `consent_records` só ganha a linha de marketing
 * depois que a pessoa clica no link que chegou na caixa dela — porque é esse clique, e nada antes
 * dele, que prova que quem digitou o endereço era o dono. Sem isso o registro de consentimento
 * seria uma afirmação nossa sobre um terceiro, que é exatamente o que ele deveria evitar.
 *
 * ── Três problemas resolvidos de uma vez ──────────────────────────────────────────────────────
 * Inscrever o e-mail de outra pessoa deixa de funcionar; erro de digitação nunca vira endereço
 * morto na lista (e portanto nunca vira bounce, que derruba a reputação do domínio); e a lista
 * passa a ter só gente que quis mesmo.
 */

// Mesmo texto que a caixa mostra — importado, nunca reescrito aqui. Ver o módulo para o porquê.
import { TEXTO_ACEITE_NEWSLETTER as TEXTO_ACEITE } from "./consentimento-texto";

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ai-os-sable.vercel.app").replace(/\/$/, "");
}

const emailValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e);

/**
 * Limite de taxa por IP.
 *
 * Fica em memória de propósito, e isso tem limite conhecido: cada instância serverless tem o seu
 * mapa, então o teto real é por instância, não global. Ainda assim segura o caso que importa — o
 * script que dispara centenas de inscrições em segundos de um endereço só. Contra um ataque
 * distribuído não segura, e a defesa dele é a confirmação por e-mail: sem clique, nada vira
 * consentimento nem entra em lista nenhuma.
 */
const JANELA_MS = 10 * 60 * 1000;
const TETO = 5;
const tentativas = new Map<string, number[]>();

function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const antes = (tentativas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  antes.push(agora);
  tentativas.set(ip, antes);
  if (tentativas.size > 5000) tentativas.clear();   // teto de memória; perde histórico, não corretude
  return antes.length > TETO;
}

export type ResultadoInscricao = { ok: boolean; mensagem: string };

export async function inscrever(dados: { email: string; nome?: string; empresa?: string; aceite: boolean }): Promise<ResultadoInscricao> {
  const email = (dados.email ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { ok: false, mensagem: "Confira o e-mail — parece estar incompleto." };
  if (!dados.aceite) return { ok: false, mensagem: "Para receber os e-mails, é preciso marcar a autorização." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip)) {
    return { ok: false, mensagem: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." };
  }

  const sb = createServiceClient();

  /**
   * Quem já confirmou não recebe outro pedido de confirmação — e a resposta na tela é a MESMA de
   * quem acabou de se inscrever. Dizer "esse e-mail já está na lista" transformaria o formulário
   * num verificador de quem assina a newsletter, para qualquer um que quisesse testar endereços.
   */
  const { data: existente } = await sb.from("newsletter_inscricoes")
    .select("id, confirmado_em").ilike("email", email).maybeSingle();

  if (existente?.confirmado_em) {
    await auditService("newsletter.reinscricao_ja_confirmada", "newsletter_inscricoes", existente.id as string, { email });
    return { ok: true, mensagem: "Pronto! Se este endereço ainda não estava na lista, você vai receber um e-mail para confirmar." };
  }

  const agora = new Date().toISOString();
  const expira = new Date(Date.now() + 7 * 86400000).toISOString();
  const registro = {
    email, nome: dados.nome?.trim() || null, empresa: dados.empresa?.trim() || null,
    texto_aceite: TEXTO_ACEITE, ip, user_agent: h.get("user-agent"),
    cancelado_em: null, expira_em: expira,
  };

  let token: string | null = null;
  if (existente) {
    // Pedido repetido: renova o token e o prazo em vez de empilhar linhas.
    const { data } = await sb.from("newsletter_inscricoes")
      .update({ ...registro, token: undefined, created_at: agora })
      .eq("id", existente.id).select("token").maybeSingle();
    token = (data?.token as string) ?? null;
  } else {
    const { data, error } = await sb.from("newsletter_inscricoes").insert(registro).select("token").single();
    if (error) {
      console.error("[newsletter] não gravou inscrição:", error.message);
      return { ok: false, mensagem: "Não consegui registrar agora. Tente de novo em instantes." };
    }
    token = data.token as string;
  }

  if (token) await mandarConfirmacao(email, dados.nome?.trim() || null, token);
  await auditService("newsletter.inscricao_pendente", "newsletter_inscricoes", undefined, { email });

  return { ok: true, mensagem: "Pronto! Se este endereço ainda não estava na lista, você vai receber um e-mail para confirmar." };
}

async function mandarConfirmacao(email: string, nome: string | null, token: string): Promise<void> {
  const link = `${baseUrl()}/inscrever/confirmar/${token}`;
  await sendEmail({
    to: email,
    subject: "Confirme sua inscrição — Salestrack AI",
    title: "Falta um clique",
    bodyHtml:
      `<p>${nome ? `Olá, ${nome}!` : "Olá!"} Recebemos um pedido para enviar os e-mails da Salestrack AI para este endereço.</p>`
      + `<p>Clique abaixo para confirmar. <b>Enquanto você não confirmar, não mandamos nada</b> — e se não foi você quem pediu, é só ignorar este e-mail: sem o clique, o endereço não entra em lista nenhuma.</p>`
      + `<p style="color:#6B7A8D;font-size:13px">O link vale por 7 dias.</p>`,
    cta: { label: "Confirmar inscrição", url: link },
  });
}

export type ResultadoConfirmacao = { estado: "confirmado" | "ja_confirmado" | "expirado" | "invalido"; email?: string };

/**
 * O clique que vale.
 *
 * É aqui — e só aqui — que nasce o registro em `consent_records` com finalidade `marketing` e
 * estado `concedido`. A partir deste momento o endereço passa nos três portões da audiência e
 * pode receber campanha.
 */
export async function confirmarInscricao(token: string): Promise<ResultadoConfirmacao> {
  const sb = createServiceClient();
  const { data: i } = await sb.from("newsletter_inscricoes")
    .select("id, email, nome, texto_aceite, ip, user_agent, confirmado_em, expira_em, cancelado_em, origem")
    .eq("token", token).maybeSingle();

  if (!i || i.cancelado_em) return { estado: "invalido" };
  if (i.confirmado_em) return { estado: "ja_confirmado", email: i.email as string };
  if (new Date(i.expira_em as string) < new Date()) return { estado: "expirado", email: i.email as string };

  const agora = new Date().toISOString();
  await sb.from("newsletter_inscricoes").update({ confirmado_em: agora }).eq("id", i.id);

  const email = String(i.email).toLowerCase();
  await sb.from("consent_records").insert({
    email,
    finalidade: "marketing",
    base_legal: "consentimento",
    estado: "concedido",
    concedido_em: agora,
    origem: "inscrição na newsletter (dupla confirmação)",
    texto_aceite: i.texto_aceite,
    ip: i.ip,
    user_agent: i.user_agent,
    updated_at: agora,
  });

  // O gate de canal acompanha, para o envio não precisar reinterpretar o consentimento.
  await sb.from("comms_consent").upsert(
    { org_id: null, canal: "email", endereco: email, opt_in: true, base: "inscrição confirmada pelo titular" },
    { onConflict: "org_id,canal,endereco" },
  );

  await auditService("newsletter.confirmada", "newsletter_inscricoes", i.id as string, { email });
  return { estado: "confirmado", email };
}
