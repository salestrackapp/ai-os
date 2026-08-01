import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { linkDescadastro, linkDescadastroUmClique } from "@/lib/lgpd/consentimento";
import { montarAudiencia, type Segmento } from "./audiencia";
import { renderEmail, renderTexto, type Bloco } from "./blocos";

/**
 * O disparo.
 *
 * ── Um e-mail por pessoa, nunca um e-mail para muitas ─────────────────────────────────────────
 * Cada destinatário recebe uma requisição própria ao Resend. Poderia ir tudo num `to[]` — seria
 * mais rápido e mais barato — mas aí todo mundo veria o endereço de todo mundo, o link de
 * descadastro seria o mesmo para a lista inteira (descadastrar um tiraria outro) e as variáveis não
 * poderiam ser resolvidas por pessoa. Os três motivos são fatais; o custo é aceitável.
 *
 * ── Idempotência é linha no banco, não variável em memória ────────────────────────────────────
 * A linha em `email_envios` é criada ANTES da chamada ao Resend, com a chave única (campanha,
 * e-mail). Se o processo cair no meio e alguém reprocessar, quem já tem linha não recebe de novo.
 * O caso que isso evita é o pior possível numa ferramenta de e-mail: mandar a mesma campanha duas
 * vezes para a mesma pessoa.
 */

const RESEND = "https://api.resend.com/emails";
const REMETENTE_PADRAO = process.env.EMAIL_MARKETING_FROM ?? "Salestrack AI <aios@salestrack.com.br>";

export function resendConfigurado(): boolean { return !!process.env.RESEND_API_KEY; }

export type ResultadoDisparo = {
  enviados: number; falhas: number; pulados: number;
  degradado?: boolean; erro?: string;
};

async function enviarUm(opts: {
  para: string; nome: string | null; assunto: string; html: string; texto: string; remetente: string;
  unsubscribeUrl?: string | null;
}): Promise<{ ok: boolean; providerRef?: string | null; erro?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, erro: "RESEND_API_KEY não configurada." };
  try {
    const res = await fetch(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: opts.remetente,
        to: [opts.para],
        subject: opts.assunto,
        html: opts.html,
        text: opts.texto,
        /**
         * `List-Unsubscribe` + One-Click: Gmail e Outlook passam a mostrar o "cancelar inscrição"
         * nativo no topo da mensagem. Quem quer sair usa esse botão em vez de marcar como spam — e
         * reclamação de spam machuca a reputação do domínio inteiro, inclusive dos e-mails
         * transacionais que nada têm a ver com a campanha.
         *
         * O One-Click só é declarado quando existe URL, porque ele obriga a aceitar POST: anunciar
         * o cabeçalho e devolver erro no POST é pior do que não anunciar — o provedor registra a
         * falha contra o domínio.
         */
        ...(opts.unsubscribeUrl ? {
          headers: {
            "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, erro: `Resend ${res.status}: ${json?.message ?? ""}`.trim() };
    return { ok: true, providerRef: json?.id ?? null };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/**
 * Envia UM e-mail de teste para o endereço de quem está montando a campanha.
 *
 * Passa por fora dos portões de consentimento de propósito, e só por isto: o destinatário é a
 * própria pessoa que apertou o botão. Não toca em `email_envios` — teste não é envio, e contaminar
 * a métrica da campanha com o próprio teste tornaria a taxa de abertura mentirosa desde o começo.
 */
export async function enviarTeste(campanhaId: string, para: string): Promise<{ ok: boolean; erro?: string }> {
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas").select("*").eq("id", campanhaId).maybeSingle();
  if (!c) return { ok: false, erro: "Campanha não encontrada." };
  if (!resendConfigurado()) return { ok: false, erro: "Resend não está configurado (falta RESEND_API_KEY)." };

  const dados = { nome: "Teste", nome_completo: "Teste da Salestrack", empresa: "Salestrack AI" };
  const base = {
    assunto: c.assunto as string, preheader: c.preheader as string | null,
    blocos: (c.blocos ?? []) as Bloco[], remetente: (c.remetente as string) ?? REMETENTE_PADRAO,
    unsubscribeUrl: await linkDescadastro(para), dados, endereco: para,
  };
  const r = await enviarUm({
    para, nome: "Teste",
    assunto: `[TESTE] ${c.assunto}`,
    html: renderEmail(base), texto: renderTexto(base),
    remetente: (c.remetente as string) ?? REMETENTE_PADRAO,
  });
  await auditService("email_mkt.teste", "email_campanhas", campanhaId, { para, ok: r.ok, erro: r.erro });
  return { ok: r.ok, erro: r.erro };
}

/**
 * Dispara a campanha aprovada.
 *
 * A audiência é remontada AQUI, e não lida de uma lista congelada na aprovação. Entre aprovar e
 * disparar pode ter passado um dia — e nesse dia alguém pode ter pedido para sair. Quem pediu para
 * sair não recebe, mesmo que a campanha já estivesse aprovada com o nome dele dentro.
 */
export async function dispararCampanha(campanhaId: string, atorId: string): Promise<ResultadoDisparo> {
  const sb = createServiceClient();
  const { data: c } = await sb.from("email_campanhas").select("*").eq("id", campanhaId).maybeSingle();
  if (!c) return { enviados: 0, falhas: 0, pulados: 0, erro: "Campanha não encontrada." };
  if (c.status !== "aprovada") return { enviados: 0, falhas: 0, pulados: 0, erro: "Só campanha aprovada pode ser disparada." };
  if (!resendConfigurado()) return { enviados: 0, falhas: 0, pulados: 0, degradado: true, erro: "Resend não está configurado." };

  await sb.from("email_campanhas").update({ status: "enviando", updated_at: new Date().toISOString() }).eq("id", campanhaId);

  const { destinatarios } = await montarAudiencia((c.segmento ?? {}) as Segmento);
  const remetente = (c.remetente as string) ?? REMETENTE_PADRAO;
  const blocos = (c.blocos ?? []) as Bloco[];

  let enviados = 0, falhas = 0, pulados = 0;

  for (const d of destinatarios) {
    // A linha nasce antes do envio: é ela que impede o reenvio se algo cair no meio.
    const { error: jaExiste } = await sb.from("email_envios").insert({
      campanha_id: campanhaId, contact_id: d.contactId, email: d.email, nome: d.nomeCompleto, status: "pendente",
    });
    if (jaExiste) { pulados++; continue; }   // conflito de chave única = já processado

    const dados = { nome: d.nome, nome_completo: d.nomeCompleto, empresa: d.empresa };
    const [saida, saidaUmClique] = await Promise.all([linkDescadastro(d.email), linkDescadastroUmClique(d.email)]);
    const base = {
      assunto: c.assunto as string, preheader: c.preheader as string | null, blocos, remetente,
      unsubscribeUrl: saida, dados, endereco: d.email,
    };

    const r = await enviarUm({
      para: d.email, nome: d.nome,
      assunto: resolverAssunto(c.assunto as string, dados),
      html: renderEmail(base), texto: renderTexto(base), remetente,
      unsubscribeUrl: saidaUmClique || saida,
    });

    await sb.from("email_envios").update({
      status: r.ok ? "enviado" : "falhou",
      provider_ref: r.providerRef ?? null, erro: r.erro ?? null,
      enviado_em: r.ok ? new Date().toISOString() : null,
    }).eq("campanha_id", campanhaId).eq("email", d.email);

    if (r.ok) enviados++; else falhas++;
  }

  await sb.from("email_campanhas").update({
    status: "enviada", enviada_em: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", campanhaId);
  await auditService("email_mkt.disparo", "email_campanhas", campanhaId, { enviados, falhas, pulados, por: atorId });

  return { enviados, falhas, pulados };
}

/** O assunto também aceita variáveis — é onde a personalização mais rende, e onde mais se esquece. */
function resolverAssunto(assunto: string, dados: Record<string, string | null>): string {
  return assunto.replace(/\{\{\s*(\w+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g, (_m, k: string, padrao?: string) =>
    (dados[k] ?? "").trim() || (padrao ?? "").trim() || "");
}

export type ResultadoCampanha = {
  total: number; enviados: number; entregues: number; abertos: number; clicados: number;
  falhas: number; bounces: number; reclamacoes: number;
};

export async function resultadoDaCampanha(campanhaId: string): Promise<ResultadoCampanha> {
  const sb = createServiceClient();
  const { data } = await sb.from("email_envios").select("status, aberto_em, clicado_em").eq("campanha_id", campanhaId);
  const linhas = data ?? [];
  return {
    total: linhas.length,
    enviados: linhas.filter((l) => l.status !== "pendente" && l.status !== "falhou").length,
    entregues: linhas.filter((l) => ["entregue", "aberto", "clicado"].includes(l.status as string)).length,
    abertos: linhas.filter((l) => l.aberto_em).length,
    clicados: linhas.filter((l) => l.clicado_em).length,
    falhas: linhas.filter((l) => l.status === "falhou").length,
    bounces: linhas.filter((l) => l.status === "bounce").length,
    reclamacoes: linhas.filter((l) => l.status === "reclamado").length,
  };
}
