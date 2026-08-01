import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { EMAIL_ENCARREGADO, NOME_ENCARREGADO } from "./contato";
import { inventarioTitular } from "./titular";

/**
 * A via de entrada do titular: da página pública até o pedido registrado.
 *
 * ── Por que existe ────────────────────────────────────────────────────────────────────────────
 * Os avisos de privacidade dizem "escreva para o encarregado". Isso atende à lei no papel e falha
 * na prática: o e-mail chega numa caixa, e o prazo de 15 dias do art. 19 só começa a contar quando
 * alguém lembra de transcrever aquilo à mão. Um pedido esquecido na caixa e um pedido que nunca
 * chegou produzem exatamente o mesmo silêncio — e o primeiro é uma infração.
 *
 * ── O clique é que cria o pedido ──────────────────────────────────────────────────────────────
 * Enviar o formulário guarda uma intenção em `dsr_confirmacoes`. Só o clique no link que chegou
 * NAQUELA caixa cria a linha em `dsr_requests`. É a prova de identidade que o art. 18 §5 exige, e
 * é o que impede o caso que importa: alguém pedir a exclusão dos dados de outra pessoa.
 *
 * O relógio legal nasce no clique, e não no envio — de propósito. Contar a partir de uma submissão
 * não verificada permitiria que um estranho iniciasse o prazo da Salestrack.
 */

// O vocabulário mora num módulo puro, compartilhado com o formulário — ver `tipos-pedido.ts`.
import { TIPOS_PEDIDO, ehTipoPedido, PRAZO_RESPOSTA_DIAS as PRAZO_DIAS, type TipoPedido } from "./tipos-pedido";
export type { TipoPedido };

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ai-os-sable.vercel.app").replace(/\/$/, "");
}

const emailValido = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e);

/**
 * Limite de taxa por IP, em memória — mesmo desenho e mesmo limite conhecido da inscrição: o mapa
 * é por instância serverless, então o teto real não é global. Segura o script que dispara em
 * rajada de um endereço só; contra ataque distribuído quem segura é a confirmação por e-mail, sem
 * a qual nada vira pedido.
 */
const JANELA_MS = 10 * 60 * 1000;
const TETO = 3;
const tentativas = new Map<string, number[]>();

function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const antes = (tentativas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  antes.push(agora);
  tentativas.set(ip, antes);
  if (tentativas.size > 5000) tentativas.clear();
  return antes.length > TETO;
}

export type ResultadoPedido = { ok: boolean; mensagem: string };

export async function abrirPedido(dados: {
  tipo: string; email: string; nome?: string; detalhe?: string;
}): Promise<ResultadoPedido> {
  const email = (dados.email ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { ok: false, mensagem: "Confira o e-mail — parece estar incompleto." };
  if (!ehTipoPedido(dados.tipo)) return { ok: false, mensagem: "Escolha o que você quer pedir." };
  const tipo = dados.tipo;

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip)) {
    return { ok: false, mensagem: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." };
  }

  const sb = createServiceClient();
  const { data, error } = await sb.from("dsr_confirmacoes").insert({
    tipo, email,
    nome: dados.nome?.trim() || null,
    detalhe: dados.detalhe?.trim() || null,
    ip, user_agent: h.get("user-agent"),
  }).select("token").single();

  if (error) {
    console.error("[LGPD] não gravou pedido público:", error.message);
    return { ok: false, mensagem: "Não consegui registrar agora. Tente de novo em instantes." };
  }

  await mandarConfirmacao(email, dados.nome?.trim() || null, tipo, data.token as string);
  await auditService("lgpd.pedido.pendente", "dsr_confirmacoes", undefined, { tipo, email });

  /**
   * A resposta na tela não confirma nem nega que o endereço existe na base. Dizer "não temos nada
   * sobre você" aqui transformaria o formulário público num verificador de quem está no CRM, para
   * qualquer um que quisesse testar endereços.
   */
  return {
    ok: true,
    mensagem: "Enviamos um e-mail para este endereço com um link de confirmação. O pedido começa a valer quando você clicar nele.",
  };
}

async function mandarConfirmacao(email: string, nome: string | null, tipo: TipoPedido, token: string): Promise<void> {
  const link = `${baseUrl()}/privacidade/direitos/confirmar/${token}`;
  await sendEmail({
    to: email,
    subject: "Confirme seu pedido sobre dados pessoais — Salestrack AI",
    title: "Falta um clique para o pedido valer",
    bodyHtml:
      `<p>${nome ? `Olá, ${nome}!` : "Olá!"} Recebemos um pedido feito em nome deste endereço: <b>${TIPOS_PEDIDO[tipo].curto}</b>.</p>`
      + `<p>Confirme abaixo para o pedido entrar. A partir do clique temos <b>${PRAZO_DIAS} dias</b> para responder.</p>`
      + `<p><b>Se não foi você quem pediu, é só ignorar este e-mail.</b> Sem o clique, nada acontece com seus dados — pedimos a confirmação justamente para que ninguém possa mexer nos dados de outra pessoa.</p>`
      + `<p style="color:#6B7A8D;font-size:13px">O link vale por 3 dias. Dúvidas: ${NOME_ENCARREGADO}, ${EMAIL_ENCARREGADO}.</p>`,
    cta: { label: "Confirmar meu pedido", url: link },
  });
}

export type ResultadoConfirmacao = {
  estado: "confirmado" | "ja_confirmado" | "expirado" | "invalido";
  tipo?: TipoPedido;
  prazoEm?: string;
};

export type PedidoPendente = {
  estado: "pendente" | "ja_confirmado" | "expirado" | "invalido";
  tipo?: TipoPedido;
  email?: string;
};

/**
 * Lê a submissão sem confirmá-la — é o que a tela mostra antes do botão.
 *
 * Existe porque aqui a confirmação NÃO acontece no GET, diferente da newsletter. Lá, um scanner
 * de e-mail corporativo que segue links erra para o lado de inscrever quem pediu para se inscrever.
 * Aqui erraria para o lado de confirmar um pedido de EXCLUSÃO que um terceiro abriu em nome da
 * pessoa — e um scanner clicando sozinho não é a pessoa concordando. O segundo clique, deliberado,
 * é o que separa "a mensagem chegou nessa caixa" de "o dono da caixa quer isso".
 */
export async function lerPedidoPendente(token: string): Promise<PedidoPendente> {
  const sb = createServiceClient();
  const { data: c } = await sb.from("dsr_confirmacoes")
    .select("tipo, email, confirmado_em, expira_em").eq("token", token).maybeSingle();

  if (!c) return { estado: "invalido" };
  const base = { tipo: c.tipo as TipoPedido, email: c.email as string };
  if (c.confirmado_em) return { estado: "ja_confirmado", ...base };
  if (new Date(c.expira_em as string) < new Date()) return { estado: "expirado", ...base };
  return { estado: "pendente", ...base };
}

/**
 * O clique que vale: cria o pedido de verdade.
 *
 * O inventário é tirado AGORA e fica anexado — é a fotografia do que existia quando a pessoa pediu,
 * e é ele que sustenta a resposta depois que os dados forem apagados. Mesma disciplina que
 * `registrarPedido` já usa no admin.
 *
 * O que este clique NÃO faz: apagar nada. Mesmo num pedido de exclusão, quem executa é uma pessoa
 * em /admin/lgpd, porque exclusão é irreversível e há dados que a lei manda preservar (contrato
 * assinado, trilha de auditoria). Confirmar inicia o prazo; não dispara a máquina.
 */
export async function confirmarPedido(token: string): Promise<ResultadoConfirmacao> {
  const sb = createServiceClient();
  const { data: c } = await sb.from("dsr_confirmacoes")
    .select("id, tipo, email, nome, detalhe, ip, user_agent, confirmado_em, expira_em")
    .eq("token", token).maybeSingle();

  if (!c) return { estado: "invalido" };
  if (c.confirmado_em) return { estado: "ja_confirmado", tipo: c.tipo as TipoPedido };
  if (new Date(c.expira_em as string) < new Date()) return { estado: "expirado", tipo: c.tipo as TipoPedido };

  const agora = new Date();
  const prazo = new Date(agora.getTime() + PRAZO_DIAS * 86400000);
  const email = String(c.email).toLowerCase();

  const { data: pedido, error } = await sb.from("dsr_requests").insert({
    tipo: c.tipo, email, nome: c.nome, detalhe: c.detalhe,
    status: "recebido",
    origem: "pagina_publica",
    ip: c.ip, user_agent: c.user_agent,
    recebido_em: agora.toISOString(),
    prazo_em: prazo.toISOString(),
    inventario: await inventarioTitular(email),
  }).select("id").single();

  if (error) {
    console.error("[LGPD] confirmação não virou pedido:", error.message);
    return { estado: "invalido" };
  }

  await sb.from("dsr_confirmacoes")
    .update({ confirmado_em: agora.toISOString(), dsr_request_id: pedido.id })
    .eq("id", c.id);

  await auditService("lgpd.pedido.confirmado", "dsr_requests", pedido.id as string, {
    tipo: c.tipo, email, origem: "pagina_publica",
  });

  await avisarEncarregado(c.tipo as TipoPedido, email, prazo);

  return { estado: "confirmado", tipo: c.tipo as TipoPedido, prazoEm: prazo.toISOString() };
}

/**
 * O encarregado é avisado no mesmo instante.
 *
 * Não é redundante com o alerta de prazo: aquele existe para o pedido que ninguém viu, este para
 * que o pedido seja visto. Falhar aqui não pode desfazer a confirmação — o pedido já está gravado,
 * e a tela do titular precisa dizer "pronto".
 */
async function avisarEncarregado(tipo: TipoPedido, email: string, prazo: Date): Promise<void> {
  try {
    await sendEmail({
      to: EMAIL_ENCARREGADO,
      subject: `Pedido de titular (${tipo}) — responder até ${prazo.toLocaleDateString("pt-BR")}`,
      title: "Novo pedido sobre dados pessoais",
      bodyHtml:
        `<p><b>${email}</b> confirmou um pedido de <b>${TIPOS_PEDIDO[tipo].curto}</b>.</p>`
        + `<p>Prazo legal para responder: <b>${prazo.toLocaleDateString("pt-BR")}</b> (15 dias).</p>`,
      cta: { label: "Abrir em Configurar › LGPD", url: `${baseUrl()}/admin/lgpd` },
    });
  } catch (e) {
    console.error("[LGPD] não avisou o encarregado:", (e as Error).message);
  }
}
