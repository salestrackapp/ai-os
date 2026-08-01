import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * A casca de toda rota de cron: autentica, executa, registra.
 *
 * ── Por que registrar até quando não há nada a fazer ──────────────────────────────────────────
 * Um job diário quebrado e um job diário correto que não encontrou trabalho produzem o MESMO
 * silêncio. Sem uma linha dizendo "rodei às 5h e não havia nada", a única forma de descobrir que
 * um cron parou é sentir falta do resultado — o que acontece semanas depois, quando o estrago já
 * está feito. A linha é escrita sempre.
 *
 * ── Erro não vira 500 ─────────────────────────────────────────────────────────────────────────
 * O agendador da Vercel não faz nada de útil com um 500 além de registrar num log que ninguém lê.
 * A falha é gravada aqui, com a mensagem, e a resposta sai 200: quem precisa saber é a tela de
 * Administração, não o agendador.
 */

export type ResultadoCron = Record<string, unknown>;

export async function comRegistro(
  nome: string,
  req: Request,
  tarefa: () => Promise<ResultadoCron>,
): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });

  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    // Chamada não autorizada NÃO vira linha: senão qualquer um enche a tabela de saúde de ruído.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inicio = Date.now();
  let resumo: ResultadoCron = {};
  let erro: string | null = null;

  try {
    resumo = await tarefa();
  } catch (e) {
    erro = (e as Error).message;
    console.error(`[cron ${nome}] falhou:`, erro);
  }

  try {
    await createServiceClient().from("cron_execucoes").insert({
      nome,
      iniciado_em: new Date(inicio).toISOString(),
      duracao_ms: Date.now() - inicio,
      ok: !erro,
      resumo,
      erro,
    });
  } catch (e) {
    // Registrar é observabilidade: falhar aqui não pode transformar uma rodada boa em rodada ruim.
    console.error(`[cron ${nome}] não registrou a execução:`, (e as Error).message);
  }

  return NextResponse.json({ ok: !erro, ...resumo, ...(erro ? { erro } : {}) });
}

export type SaudeDoCron = {
  nome: string;
  ultima: string | null;
  horasDesde: number | null;
  ok: boolean;
  erro: string | null;
  resumo: Record<string, unknown>;
  /** Nunca rodou desde que o registro existe, ou passou de um dia e meio sem rodar. */
  suspeito: boolean;
};

/**
 * Todos os crons declarados e quando cada um rodou pela última vez.
 *
 * A lista de nomes vem do CÓDIGO e não do banco: um cron que nunca rodou não tem linha nenhuma, e
 * é exatamente esse que precisa aparecer na tela. Montar a lista a partir do que já rodou
 * esconderia justamente o que está quebrado.
 */
export const CRONS: { nome: string; horario: string; oQueFaz: string }[] = [
  { nome: "engajamento", horario: "03:00 UTC", oQueFaz: "Decai o engajamento dos prospects com o tempo." },
  { nome: "retencao", horario: "04:00 UTC", oQueFaz: "Apaga o que passou do prazo de retenção (LGPD)." },
  { nome: "prospeccao", horario: "05:00 UTC", oQueFaz: "Roda as buscas automáticas do Apollo." },
  { nome: "ops", horario: "06:00 UTC", oQueFaz: "Calcula saúde por cliente e levanta alertas." },
  { nome: "coleta", horario: "06:00 UTC", oQueFaz: "Coleta externa de sinais (Apify), quando ligada." },
  { nome: "relacionamento", horario: "07:00 UTC", oQueFaz: "Sincroniza a caixa, tria e prepara rascunhos." },
  { nome: "orchestrate", horario: "09:00 UTC", oQueFaz: "Avalia a régua de comunicação dos programas." },
  { nome: "cobranca", horario: "10:00 UTC", oQueFaz: "Sincroniza com a ASAAS e roda a régua de cobrança." },
  { nome: "tarefas", horario: "11:00 UTC", oQueFaz: "Avisa sobre tarefa vencendo e vencida." },
  { nome: "leads", horario: "11:30 UTC", oQueFaz: "Unifica os leads dos sites em contatos." },
  { nome: "cadence", horario: "12:00 UTC", oQueFaz: "Avança as cadências de prospecção." },
];

const LIMITE_HORAS = 36;   // um dia e meio: cobre atraso do agendador sem esconder um dia perdido

export async function saudeDosCrons(): Promise<SaudeDoCron[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("cron_execucoes")
    .select("nome, iniciado_em, ok, erro, resumo")
    .order("iniciado_em", { ascending: false }).limit(400);

  const ultima = new Map<string, { iniciado_em: string; ok: boolean; erro: string | null; resumo: Record<string, unknown> }>();
  for (const r of data ?? []) {
    if (!ultima.has(r.nome as string)) {
      ultima.set(r.nome as string, {
        iniciado_em: r.iniciado_em as string, ok: r.ok as boolean,
        erro: (r.erro as string) ?? null, resumo: (r.resumo ?? {}) as Record<string, unknown>,
      });
    }
  }

  return CRONS.map((c) => {
    const u = ultima.get(c.nome);
    const horas = u ? Math.floor((Date.now() - new Date(u.iniciado_em).getTime()) / 3600000) : null;
    return {
      nome: c.nome,
      ultima: u?.iniciado_em ?? null,
      horasDesde: horas,
      ok: u?.ok ?? true,
      erro: u?.erro ?? null,
      resumo: u?.resumo ?? {},
      suspeito: u == null || horas! > LIMITE_HORAS || !u.ok,
    };
  });
}
