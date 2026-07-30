import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { getProviderConfig } from "@/lib/settings/secrets";
import { ensureAsaasCustomer } from "@/lib/asaas";
import { sendEmail, emailAdmin } from "@/lib/email";
import { diasAte } from "@/lib/formato/data";

/**
 * Régua de cobrança — e sincronização com o ASAAS.
 *
 * ── Quem é a fonte da verdade ─────────────────────────────────────────────────────────────────
 * **O ASAAS.** As cobranças da IMAGO já existem lá; o que estava desatualizado era o AI OS, que
 * mostrava cinco faturas "em aberto" sem link de pagamento. A primeira versão deste arquivo ia
 * CRIAR cobranças para elas — o que teria gerado cinco boletos duplicados para um cliente real.
 *
 * Por isso a ordem é: sincronizar primeiro, criar só o que comprovadamente não existe lá, e nunca
 * criar em automático. Cobrar o mesmo boleto duas vezes custa a relação, não só o dinheiro.
 *
 * ── Como as duas pontas se casam ──────────────────────────────────────────────────────────────
 * Por `externalReference` quando existe (é o que gravamos ao criar por aqui). Quando não existe —
 * caso das cobranças criadas direto no painel do ASAAS —, o casamento é por **organização + valor
 * + vencimento**, que é a combinação que identifica uma parcela sem ambiguidade. Um par duvidoso
 * é deixado de fora e reportado, nunca adivinhado: casar errado significa marcar como paga uma
 * fatura que não foi.
 *
 * ── Três avisos, três tons ────────────────────────────────────────────────────────────────────
 * Três dias antes é lembrete; no dia é aviso; depois é cobrança. O mesmo texto nos três momentos
 * ou soa agressivo cedo demais, ou frouxo tarde demais. E cada um sai UMA vez — a coluna de
 * carimbo existe para isso, porque cliente que recebe a mesma cobrança três vezes na mesma semana
 * não paga mais rápido, só fica irritado.
 */

const DIAS_AVISO_PREVIO = 3;

/**
 * Regra de inadimplência vigente desde 30/07/2026 (cláusulas 3.6 a 3.9 da biblioteca).
 *
 * ATENÇÃO: contrato assinado ANTES desta data mantém a regra que pactuou. O da IMAGO diz 2% e
 * suspensão em 10 dias; a cláusula 11.5 dele exige termo aditivo para mudar. Por isso a multa é
 * calculada a partir do que o CONTRATO guarda, não de uma constante global — cobrar 10% de quem
 * assinou 2% é cobrança indevida, e das que se explicam mal depois.
 */
export const MULTA_PADRAO = 0.10;
export const JUROS_MES = 0.01;
/** Vencidas 2 faturas, cabe cancelamento provisório: suspende sem extinguir. */
export const FATURAS_PARA_SUSPENDER = 2;

/** Multa e juros de UMA fatura, pela regra do contrato dela. */
export function encargos(valor: number, diasDeAtraso: number, multaPactuada = MULTA_PADRAO): {
  multa: number; juros: number; total: number;
} {
  if (diasDeAtraso <= 0) return { multa: 0, juros: 0, total: valor };
  const multa = valor * multaPactuada;
  const juros = valor * JUROS_MES * (diasDeAtraso / 30);   // pro rata die, como diz a cláusula
  return {
    multa: Math.round(multa * 100) / 100,
    juros: Math.round(juros * 100) / 100,
    total: Math.round((valor + multa + juros) * 100) / 100,
  };
}

export type Fatura = {
  id: string; org_id: string; amount: number; due_date: string; status: string;
  kind: string | null; installment_n: number | null; installments_total: number | null;
  stripe_invoice_id: string | null; hosted_url: string | null; paid_at: string | null;
  multa_pactuada: number | null;                 // o que o CONTRATO daquele cliente diz, não o padrão
  cobranca_gerada_em: string | null;
  aviso_previo_em: string | null; aviso_vencimento_em: string | null; aviso_atraso_em: string | null;
};

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A data de vencimento é coluna `date`: sem o sufixo UTC, o fuso mostra o dia anterior. */
function dataDaFatura(f: Fatura): string {
  return new Date(f.due_date + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function descricao(f: Fatura): string {
  const tipo = f.kind === "implantacao" ? "Implantação" : f.kind === "manutencao" ? "Plataforma AI OS" : "Serviços";
  const parcela = f.installment_n && f.installments_total
    ? ` — parcela ${f.installment_n}/${f.installments_total}` : "";
  return `${tipo}${parcela}`;
}

async function asaasFetch(caminho: string, init?: { method?: string; body?: Record<string, unknown> }): Promise<Record<string, unknown>> {
  const cfg = await getProviderConfig("asaas");
  const chave = cfg.api_key || process.env.ASAAS_API_KEY;
  if (!chave) throw new Error("Chave do ASAAS não configurada.");
  const base = (cfg.env || process.env.ASAAS_ENV) === "production"
    ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

  const r = await fetch(`${base}${caminho}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", access_token: chave },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const erros = json.errors as { description?: string }[] | undefined;
    throw new Error(erros?.[0]?.description ?? `ASAAS respondeu ${r.status}.`);
  }
  return json;
}

/** Como o ASAAS nomeia os estados, traduzido para o vocabulário das nossas faturas. */
function statusLocal(asaas: string): "paga" | "aberta" | "cancelada" {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(asaas)) return "paga";
  if (["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "DELETED"].includes(asaas)) return "cancelada";
  return "aberta";
}

export type Pagamento = {
  id: string; value: number; dueDate: string; status: string;
  invoiceUrl: string | null; paymentDate: string | null; externalReference: string | null;
  description: string | null; customer: string | null;
};

/** Lê TODOS os pagamentos do ASAAS, paginando. São dezenas, não milhares — cabe em memória. */
export async function listarPagamentosAsaas(): Promise<Pagamento[]> {
  const saida: Pagamento[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const j = await asaasFetch(`/payments?limit=100&offset=${offset}`);
    const linhas = (j.data as Record<string, unknown>[]) ?? [];
    for (const p of linhas) {
      saida.push({
        id: String(p.id), value: Number(p.value), dueDate: String(p.dueDate),
        status: String(p.status),
        invoiceUrl: (p.invoiceUrl as string) ?? (p.bankSlipUrl as string) ?? null,
        paymentDate: (p.paymentDate as string) ?? (p.clientPaymentDate as string) ?? null,
        externalReference: (p.externalReference as string) ?? null,
        description: (p.description as string) ?? null,
        customer: (p.customer as string) ?? null,
      });
    }
    if (!j.hasMore) break;
  }
  return saida;
}

export type ResultadoSincronia = {
  noAsaas: number; casadas: number; atualizadas: number; pagasDescobertas: number;
  semParNoAsaas: { id: string; valor: number; vencimento: string }[];
  semParLocal: { id: string; valor: number; vencimento: string; descricao: string | null }[];
  erro?: string;
};

/**
 * Espelha o ASAAS nas nossas faturas. **Não cria nada** — só reflete.
 *
 * O que ele descobre e o painel local não sabia: fatura já paga, link do boleto que existe lá e
 * não estava aqui, e cobrança criada direto no ASAAS sem par local (que é trabalho manual a
 * conferir, não algo para adivinhar).
 */
export async function sincronizarComAsaas(): Promise<ResultadoSincronia> {
  const sb = createServiceClient();
  const r: ResultadoSincronia = {
    noAsaas: 0, casadas: 0, atualizadas: 0, pagasDescobertas: 0, semParNoAsaas: [], semParLocal: [],
  };

  let pagamentos: Pagamento[];
  try {
    pagamentos = await listarPagamentosAsaas();
  } catch (e) {
    return { ...r, erro: (e as Error).message };
  }
  r.noAsaas = pagamentos.length;

  const { data: locais } = await sb.from("invoices").select("*");
  const faturas = (locais ?? []) as Fatura[];
  const usados = new Set<string>();

  for (const f of faturas) {
    // 1ª tentativa: a referência que nós mesmos gravamos. Sem ambiguidade nenhuma.
    let par = pagamentos.find((p) => p.externalReference === `invoice:${f.id}` || p.id === f.stripe_invoice_id);

    // 2ª: organização + valor + vencimento. Para cobrança criada direto no painel do ASAAS, é a
    // combinação que identifica a parcela. Se mais de uma bater, NENHUMA é escolhida — casar
    // errado marcaria como paga uma fatura que não foi.
    if (!par) {
      const candidatos = pagamentos.filter((p) =>
        !usados.has(p.id) &&
        Math.abs(p.value - Number(f.amount)) < 0.01 &&
        p.dueDate === f.due_date);
      if (candidatos.length === 1) par = candidatos[0];
    }

    if (!par) {
      r.semParNoAsaas.push({ id: f.id, valor: Number(f.amount), vencimento: f.due_date });
      continue;
    }

    usados.add(par.id);
    r.casadas++;

    const novoStatus = statusLocal(par.status);
    const mudou =
      f.stripe_invoice_id !== par.id ||
      f.hosted_url !== par.invoiceUrl ||
      f.status !== novoStatus ||
      (novoStatus === "paga" && !f.paid_at);

    if (!mudou) continue;

    if (novoStatus === "paga" && f.status !== "paga") r.pagasDescobertas++;

    await sb.from("invoices").update({
      stripe_invoice_id: par.id,
      hosted_url: par.invoiceUrl,
      status: novoStatus,
      paid_at: novoStatus === "paga" ? (par.paymentDate ?? new Date().toISOString().slice(0, 10)) : null,
      cobranca_gerada_em: f.cobranca_gerada_em ?? new Date().toISOString(),
      ultimo_erro_cobranca: null,
    }).eq("id", f.id);
    r.atualizadas++;
  }

  // Cobrança que existe no ASAAS e não tem fatura aqui: receita que o painel local não mostra.
  for (const p of pagamentos) {
    if (usados.has(p.id)) continue;
    if (statusLocal(p.status) === "cancelada") continue;
    r.semParLocal.push({ id: p.id, valor: p.value, vencimento: p.dueDate, descricao: p.description });
  }

  await auditService("cobranca.sincronizada", "invoices", undefined, {
    no_asaas: r.noAsaas, casadas: r.casadas, atualizadas: r.atualizadas,
    pagas_descobertas: r.pagasDescobertas,
    sem_par_no_asaas: r.semParNoAsaas.length, sem_par_local: r.semParLocal.length,
  });
  return r;
}

/**
 * Gera a cobrança de UMA fatura existente e guarda o link.
 *
 * Idempotente pelo `externalReference`: reprocessar não cria segunda cobrança para a mesma fatura,
 * e cobrar o cliente duas vezes pelo mesmo boleto é o tipo de erro que custa a relação, não só o
 * dinheiro.
 */
export async function gerarCobranca(invoiceId: string): Promise<{ ok: boolean; url?: string; erro?: string }> {
  const sb = createServiceClient();
  const { data: f } = await sb.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!f) return { ok: false, erro: "Fatura não encontrada." };
  if (f.status === "paga") return { ok: false, erro: "Esta fatura já está paga." };
  if (f.stripe_invoice_id && f.hosted_url) return { ok: true, url: f.hosted_url as string };

  const { data: org } = await sb.from("organizations")
    .select("id, name, cnpj, billing_email").eq("id", f.org_id).maybeSingle();
  if (!org) return { ok: false, erro: "Organização da fatura não encontrada." };

  try {
    const customerId = await ensureAsaasCustomer({
      name: org.name as string,
      email: (org.billing_email as string) ?? null,
      cpfCnpj: (org.cnpj as string) ?? null,
      externalReference: org.id as string,
    });

    const p = await asaasFetch("/payments", { method: "POST", body: {
      customer: customerId,
      billingType: "BOLETO",                       // boleto do ASAAS já vem com Pix embutido
      value: Number(f.amount),
      dueDate: f.due_date,                         // a data acordada manda, mesmo já vencida
      description: descricao(f as Fatura),
      externalReference: `invoice:${f.id}`,
    } });

    const url = (p.invoiceUrl as string) ?? (p.bankSlipUrl as string) ?? null;
    await sb.from("invoices").update({
      stripe_invoice_id: p.id as string,           // campo genérico de referência do provedor
      hosted_url: url,
      cobranca_gerada_em: new Date().toISOString(),
      ultimo_erro_cobranca: null,
    }).eq("id", f.id);

    await auditService("cobranca.gerada", "invoices", f.id as string,
      { valor: Number(f.amount), vencimento: f.due_date }, f.org_id as string);
    return { ok: true, url: url ?? undefined };
  } catch (e) {
    const erro = (e as Error).message;
    await sb.from("invoices").update({ ultimo_erro_cobranca: erro }).eq("id", f.id);
    console.error(`[cobrança] fatura ${f.id}:`, erro);
    return { ok: false, erro };
  }
}

/**
 * Gera cobranças para faturas que NÃO têm par no ASAAS.
 *
 * Sincroniza antes, sempre. Sem isso, uma fatura cuja cobrança foi criada direto no painel do
 * ASAAS ganharia um segundo boleto — e o cliente receberia dois pedidos de pagamento pela mesma
 * parcela.
 *
 * Não é chamada pelo cron de propósito: criar cobrança é ato comercial, e ato comercial em
 * automático é como se manda dois boletos para o mesmo cliente sem ninguém perceber.
 */
export async function gerarCobrancasFaltantes(limite = 50): Promise<{ geradas: number; falhas: number; erros: string[] }> {
  const sincronia = await sincronizarComAsaas();
  if (sincronia.erro) return { geradas: 0, falhas: 0, erros: [sincronia.erro] };

  const sb = createServiceClient();
  const erros: string[] = [];
  let geradas = 0, falhas = 0;

  for (const alvo of sincronia.semParNoAsaas.slice(0, limite)) {
    const { data: f } = await sb.from("invoices").select("status").eq("id", alvo.id).maybeSingle();
    if (!f || f.status === "paga") continue;
    const r = await gerarCobranca(alvo.id);
    if (r.ok) geradas++;
    else { falhas++; if (r.erro) erros.push(r.erro); }
  }
  return { geradas, falhas, erros };
}

type Etapa = "previo" | "vencimento" | "atraso";

const TEXTO: Record<Etapa, (f: Fatura, dias: number) => { assunto: string; corpo: string[] }> = {
  previo: (f, dias) => ({
    assunto: `Sua fatura vence em ${dias} dia${dias > 1 ? "s" : ""}`,
    corpo: [
      `Passando para lembrar: a fatura de <b>${descricao(f)}</b>, no valor de <b>${reais(Number(f.amount))}</b>, vence em ${dataDaFatura(f)}.`,
      "Se já pagou, pode ignorar esta mensagem — o sistema leva um dia útil para reconhecer.",
    ],
  }),
  vencimento: (f) => ({
    assunto: "Sua fatura vence hoje",
    corpo: [
      `A fatura de <b>${descricao(f)}</b>, no valor de <b>${reais(Number(f.amount))}</b>, vence hoje.`,
      "O boleto tem Pix embutido — dá para pagar na hora pelo link abaixo.",
    ],
  }),
  atraso: (f, dias) => {
    const e = encargos(Number(f.amount), dias, Number(f.multa_pactuada ?? MULTA_PADRAO));
    return {
      assunto: `Fatura em aberto há ${dias} dia${dias > 1 ? "s" : ""}`,
      corpo: [
        `A fatura de <b>${descricao(f)}</b>, no valor de <b>${reais(Number(f.amount))}</b>, venceu em ${dataDaFatura(f)} e ainda consta em aberto.`,
        // Os encargos são mostrados abertos, não embutidos num total. Cobrança que chega só com o
        // valor final soa arbitrária e vira discussão; discriminada, é conferível.
        `Com os encargos previstos em contrato — multa de ${(Number(f.multa_pactuada ?? MULTA_PADRAO) * 100).toFixed(0)}% (${reais(e.multa)}) e juros de 1% ao mês (${reais(e.juros)}) —, o valor atualizado é de <b>${reais(e.total)}</b>.`,
        "Se já pagou ou se houve algum problema com o boleto, é só responder este e-mail que a gente resolve.",
      ],
    };
  },
};

const CAMPO_CARIMBO: Record<Etapa, keyof Fatura> = {
  previo: "aviso_previo_em", vencimento: "aviso_vencimento_em", atraso: "aviso_atraso_em",
};

async function avisar(f: Fatura, etapa: Etapa, dias: number): Promise<boolean> {
  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations")
    .select("name, billing_email").eq("id", f.org_id).maybeSingle();
  const destino = (org?.billing_email as string) ?? null;

  // Carimba ANTES de enviar: se o envio falhar, o cliente pode não receber — mas se o carimbo
  // falhasse depois de um envio bem-sucedido, ele receberia de novo amanhã. Entre não avisar e
  // avisar duas vezes, a segunda é a que estraga a relação.
  await sb.from("invoices").update({ [CAMPO_CARIMBO[etapa]]: new Date().toISOString() }).eq("id", f.id);

  if (!destino) {
    await sb.from("cobranca_avisos").insert({
      invoice_id: f.id, org_id: f.org_id, etapa, canal: "email", enviado: false,
      erro: "A organização não tem e-mail de cobrança cadastrado.",
    });
    return false;
  }

  const { assunto, corpo } = TEXTO[etapa](f, dias);
  const r = await sendEmail({
    to: destino, subject: assunto, title: assunto,
    bodyHtml: `<p>${corpo.join("</p><p>")}</p>`,
    cta: f.hosted_url ? { label: "Abrir o boleto", url: f.hosted_url } : undefined,
  }).catch((e: unknown) => ({ ok: false, degraded: true, erro: (e as Error).message }));

  const ok = r.ok === true;
  await sb.from("cobranca_avisos").insert({
    invoice_id: f.id, org_id: f.org_id, etapa, destinatario: destino, canal: "email",
    enviado: ok, erro: ok ? null : ((r as { erro?: string }).erro ?? "envio degradado ou falhou"),
  });
  await auditService(`cobranca.aviso.${etapa}`, "invoices", f.id, { destino, enviado: ok }, f.org_id);
  return ok;
}

export type ResultadoRegua = {
  previos: number; vencimentos: number; atrasos: number;
  cobrancasGeradas: number; totalAberto: number; totalVencido: number;
  /** Clientes com 2+ faturas vencidas: cabe cancelamento provisório, se você decidir. */
  candidatosASuspensao: { orgId: string; faturasVencidas: number }[];
};

/**
 * Roda a régua inteira. É o que o cron chama.
 *
 * Gera primeiro as cobranças que faltam: avisar sobre uma fatura sem link é mandar a pessoa pagar
 * sem dizer como.
 */
export async function rodarRegua(): Promise<ResultadoRegua> {
  const sb = createServiceClient();
  const r: ResultadoRegua = {
    previos: 0, vencimentos: 0, atrasos: 0, cobrancasGeradas: 0, totalAberto: 0, totalVencido: 0,
    candidatosASuspensao: [],
  };

  /**
   * Sincroniza, não cria. Uma fatura que consta em aberto aqui pode já estar paga no ASAAS — e
   * cobrar quem já pagou é pior do que não cobrar quem deve.
   */
  const sinc = await sincronizarComAsaas();
  r.cobrancasGeradas = sinc.atualizadas;

  const { data: abertas } = await sb.from("invoices").select("*").neq("status", "paga");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  for (const bruta of (abertas ?? []) as Fatura[]) {
    const valor = Number(bruta.amount);
    r.totalAberto += valor;

    const venc = new Date(bruta.due_date + "T00:00:00");
    const dias = Math.round((venc.getTime() - hoje.getTime()) / 86400000);
    if (dias < 0) r.totalVencido += valor;

    if (dias > 0 && dias <= DIAS_AVISO_PREVIO && !bruta.aviso_previo_em) {
      if (await avisar(bruta, "previo", dias)) r.previos++;
    } else if (dias === 0 && !bruta.aviso_vencimento_em) {
      if (await avisar(bruta, "vencimento", 0)) r.vencimentos++;
    } else if (dias < 0 && !bruta.aviso_atraso_em) {
      if (await avisar(bruta, "atraso", Math.abs(dias))) r.atrasos++;
    }
  }

  /**
   * Cancelamento provisório: vencidas 2 faturas do mesmo cliente, o contrato pode ser suspenso
   * (cláusula 3.7). O sistema NÃO suspende sozinho — sinaliza para quem decide.
   *
   * Suspender serviço é ato que quebra a operação do cliente e pede comunicação escrita antes.
   * Automatizar isso é como se derruba o atendimento de uma clínica numa segunda-feira por causa
   * de um boleto que compensou no sábado.
   */
  const vencidasPorOrg = new Map<string, number>();
  for (const f of (abertas ?? []) as Fatura[]) {
    if ((diasAte(f.due_date) ?? 0) < 0) {
      vencidasPorOrg.set(f.org_id, (vencidasPorOrg.get(f.org_id) ?? 0) + 1);
    }
  }
  r.candidatosASuspensao = [...vencidasPorOrg.entries()]
    .filter(([, n]) => n >= FATURAS_PARA_SUSPENDER)
    .map(([orgId, n]) => ({ orgId, faturasVencidas: n }));

  // O aviso interno só sai quando há atraso. Um resumo diário de "está tudo em dia" vira ruído, e
  // ruído diário é o que faz alguém parar de ler a notificação que importa.
  if (r.totalVencido > 0) {
    const alerta = r.candidatosASuspensao.length
      ? `<p><b>${r.candidatosASuspensao.length} cliente(s) com ${FATURAS_PARA_SUSPENDER}+ faturas vencidas</b> — cabe cancelamento provisório pela cláusula 3.7. A decisão é sua: em Jornadas → Escopo e entregas, use "Parar um projeto".</p>`
      : "";
    await emailAdmin(
      `${reais(r.totalVencido)} em atraso`,
      "Cobranças vencidas",
      `<p>Há <b>${reais(r.totalVencido)}</b> vencido(s) e em aberto, de um total de <b>${reais(r.totalAberto)}</b>.</p>`
      + alerta + `<p>O detalhe está em Admin → Financeiro.</p>`,
    ).catch(() => {});
  }

  await auditService("cobranca.regua", "invoices", undefined, r);
  return r;
}
