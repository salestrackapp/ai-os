import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import type { TabelaLead } from "@/lib/leads/avisar";

/**
 * Consentimento sob a LGPD — o registro jurídico, separado do gate operacional de canal.
 *
 * `comms_consent` responde "posso disparar neste endereço agora?". Aqui a pergunta é outra:
 * "esta pessoa autorizou tratar o dado dela para ESTA finalidade, sob QUAL base legal, e eu
 * consigo provar?". Um consentimento que não se demonstra é o mesmo que não existir (art. 8º,
 * §2º) — por isso todo registro carrega a evidência do momento: origem, texto lido, IP e agente.
 */

export type Finalidade = "marketing" | "prospeccao" | "transacional" | "academy" | "pesquisa";
export type BaseLegal = "consentimento" | "legitimo_interesse" | "execucao_contrato" | "obrigacao_legal";

const ORIGEM_LEGIVEL: Record<TabelaLead, string> = {
  site_leads: "formulário do salestrack.com.br",
  andrekachan_leads: "formulário do andrekachan.com.br",
};

/**
 * Registra o que o formulário de captura autoriza. SEMPRE duas finalidades distintas:
 *
 *  · transacional — responder ao que a pessoa pediu. Base: execução de diligência
 *    pré-contratual a pedido do titular (art. 7º, V). Não depende de caixinha, porque foi a
 *    própria pessoa quem procurou.
 *  · marketing — conteúdo que ela não pediu. Base: consentimento, e só existe se ela marcou.
 *    Sem marca, grava-se o estado "negado": saber que ela NÃO autorizou também é informação, e
 *    é o que impede alguém de assumir o contrário mais tarde.
 */
export async function registrarConsentimentoDeLead(
  tabela: TabelaLead,
  leadId: string,
  contactId: string | null,
): Promise<void> {
  const sb = createServiceClient();
  const { data: lead } = await sb.from(tabela)
    .select("email, whatsapp, user_agent, aceite_marketing, texto_aceite")
    .eq("id", leadId).maybeSingle();
  if (!lead) return;

  const l = lead as {
    email: string; whatsapp: string | null; user_agent: string | null;
    aceite_marketing: boolean | null; texto_aceite: string | null;
  };
  const email = (l.email ?? "").trim().toLowerCase();
  if (!email) return;

  const agora = new Date().toISOString();
  const comum = {
    contact_id: contactId,
    email,
    telefone: l.whatsapp,
    origem: ORIGEM_LEGIVEL[tabela],
    user_agent: l.user_agent,
    updated_at: agora,
  };

  const linhas = [
    { ...comum, finalidade: "transacional", base_legal: "execucao_contrato",
      estado: "concedido", concedido_em: agora,
      texto_aceite: "Enviou o formulário pedindo contato." },
    { ...comum, finalidade: "marketing", base_legal: "consentimento",
      estado: l.aceite_marketing ? "concedido" : "negado",
      concedido_em: l.aceite_marketing ? agora : null,
      texto_aceite: l.texto_aceite },
  ];

  const { error } = await sb.from("consent_records").insert(linhas);
  if (error) {
    console.error(`[LGPD] falha ao registrar consentimento do lead ${leadId}: ${error.message}`);
    return;
  }

  // O gate de canal acompanha: consentiu marketing → o endereço fica liberado para envio.
  if (l.aceite_marketing) {
    await sb.from("comms_consent").upsert(
      { org_id: null, canal: "email", endereco: email, opt_in: true, base: ORIGEM_LEGIVEL[tabela] },
      { onConflict: "org_id,canal,endereco" },
    );
  }
  await auditService("lgpd.consentimento.registrado", "consent_records", undefined,
    { email, marketing: !!l.aceite_marketing, origem: tabela });
}

/**
 * O envio de marketing pergunta aqui antes de sair, e a resposta depende de DUAS coisas:
 *
 *  1. procedência — dado que a pessoa não nos deu (coleta pública, base de terceiro) nunca vira
 *     marketing, nem com caixa marcada. Esse é o bloqueio que importa: ausência de consentimento
 *     se resolve marcando uma caixa, e alguém marcaria.
 *  2. consentimento vigente do próprio titular.
 *
 * A regra mora no banco (`fn_pode_marketing`) porque precisa valer para qualquer caminho de
 * envio, não só para o que passa por esta função. Em caso de erro, responde NÃO: o padrão seguro
 * de um gate é fechar, não abrir.
 */
export async function podeEnviarMarketing(email: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("fn_pode_marketing", { p_email: email.trim() });
  if (error) {
    console.error(`[LGPD] gate de marketing falhou para ${email}: ${error.message}`);
    return false;
  }
  return data === true;
}

/**
 * Registra a base legal da PROSPECÇÃO: legítimo interesse, não consentimento.
 *
 * O par é sempre este — prospecção concedida por legítimo interesse E marketing negado. Gravar o
 * "negado" explicitamente é o que impede alguém, meses depois, de assumir que o silêncio queria
 * dizer sim.
 */
export async function registrarBaseProspeccao(dados: {
  email: string; telefone?: string | null; origem: string; contactId?: string | null;
}): Promise<void> {
  const sb = createServiceClient();
  const email = dados.email.trim().toLowerCase();
  if (!email) return;

  const agora = new Date().toISOString();
  const { data: existente } = await sb.from("consent_records")
    .select("id").ilike("email", email).eq("finalidade", "prospeccao").limit(1).maybeSingle();
  if (existente) return;                       // idempotente: reimportar não duplica o registro

  const { error } = await sb.from("consent_records").insert([
    {
      contact_id: dados.contactId ?? null, email, telefone: dados.telefone ?? null,
      finalidade: "prospeccao", base_legal: "legitimo_interesse", estado: "concedido",
      concedido_em: agora, origem: dados.origem, updated_at: agora,
      texto_aceite: "Dado profissional público tratado sob legítimo interesse para prospecção B2B. "
        + "Teste de proporcionalidade em docs/LIA_PROSPECCAO.md. O titular é avisado da origem no "
        + "primeiro contato e pode se opor a qualquer momento.",
    },
    {
      contact_id: dados.contactId ?? null, email, telefone: dados.telefone ?? null,
      finalidade: "marketing", base_legal: "consentimento", estado: "negado",
      origem: dados.origem, updated_at: agora,
      texto_aceite: "Dado não fornecido pelo titular. Marketing exige consentimento dele, que não existe.",
    },
  ]);
  if (error) console.error(`[LGPD] falha ao registrar base de prospecção de ${email}: ${error.message}`);
  else await auditService("lgpd.prospeccao.base_registrada", "consent_records", undefined, { email, origem: dados.origem });
}

/**
 * Oposição ao tratamento por legítimo interesse (art. 18, §2º). Não é o mesmo que descadastro de
 * marketing: aqui a pessoa está dizendo que não quer ser prospectada. Para o dado coletado, isso
 * significa sair da base — não há por que guardar quem disse não.
 */
export async function registrarOposicao(email: string): Promise<void> {
  const sb = createServiceClient();
  const alvo = email.trim().toLowerCase();
  const agora = new Date().toISOString();

  await sb.from("prospects").update({ oposicao_em: agora, status: "descartado" }).ilike("email", alvo);
  await sb.from("consent_records")
    .update({ estado: "revogado", revogado_em: agora, updated_at: agora })
    .ilike("email", alvo).eq("finalidade", "prospeccao").neq("estado", "revogado");
  await sb.from("comms_consent").update({ opt_in: false, base: "oposição do titular", updated_at: agora })
    .ilike("endereco", alvo);

  await auditService("lgpd.prospeccao.oposicao", "consent_records", undefined, { email: alvo });
}

/**
 * Token de descadastro por endereço, reutilizável e estável.
 *
 * Estável de propósito: o link no rodapé de um e-mail de janeiro tem que continuar funcionando
 * em dezembro. Token de uso único quebraria exatamente quem mais precisa dele — a pessoa que
 * volta a um e-mail antigo para sair.
 */
export async function tokenDescadastro(email: string, canal: "email" | "whatsapp" = "email"): Promise<string | null> {
  const sb = createServiceClient();
  const endereco = email.trim().toLowerCase();
  if (!endereco) return null;

  const { data: existente } = await sb.from("descadastro_tokens")
    .select("token").eq("canal", canal).eq("endereco", endereco).maybeSingle();
  if (existente?.token) return existente.token as string;

  const { data, error } = await sb.from("descadastro_tokens")
    .insert({ canal, endereco }).select("token").single();
  if (error) {
    console.error(`[LGPD] falha ao criar token de descadastro: ${error.message}`);
    return null;
  }
  return data.token as string;
}

export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://ai-os-sable.vercel.app";
}

/** URL pronta para o rodapé. Devolve string vazia se não deu para gerar — nunca um link quebrado. */
export async function linkDescadastro(email: string): Promise<string> {
  const t = await tokenDescadastro(email);
  return t ? `${baseUrl()}/descadastro/${t}` : "";
}

/**
 * O mesmo descadastro, no endereço que aceita POST — para o cabeçalho `List-Unsubscribe`.
 *
 * Separado do link visível de propósito: o do rodapé leva a uma página que confirma o que
 * aconteceu, e este atende o botão nativo do Gmail/Outlook, que faz POST e não mostra nada.
 */
export async function linkDescadastroUmClique(email: string): Promise<string> {
  const t = await tokenDescadastro(email);
  return t ? `${baseUrl()}/api/descadastro/${t}` : "";
}

/**
 * Revoga o consentimento de marketing. Idempotente: sair duas vezes é sair.
 * O registro NÃO some — muda de estado. O histórico é a prova de que a revogação foi atendida.
 */
export async function revogarMarketing(endereco: string, canal: "email" | "whatsapp" = "email"): Promise<void> {
  const sb = createServiceClient();
  const alvo = endereco.trim().toLowerCase();
  const agora = new Date().toISOString();

  await sb.from("consent_records")
    .update({ estado: "revogado", revogado_em: agora, updated_at: agora })
    .ilike("email", alvo).eq("finalidade", "marketing").neq("estado", "revogado");

  await sb.from("comms_consent").update({ opt_in: false, base: "descadastro pelo titular", updated_at: agora })
    .eq("canal", canal).ilike("endereco", alvo);

  await auditService("lgpd.consentimento.revogado", "consent_records", undefined, { endereco: alvo, canal });
}
