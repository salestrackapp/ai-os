import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { diasDeAtraso, dataBR } from "@/lib/formato/data";
import { brl } from "@/lib/types";

/**
 * O que precisa de você hoje — de todos os cantos do sistema, num lugar só.
 *
 * ── O buraco que isto fecha ───────────────────────────────────────────────────────────────────
 * A tela Hoje enxergava três coisas: tarefa vencida, entregável em revisão e deal parado. Tudo que
 * as fases seguintes construíram — cobrança, entregas com prazo, projeto parado, triagem da caixa,
 * rascunho do agente — ficou invisível para quem abre o sistema de manhã. Uma fatura vencida há 19
 * dias não aparecia em lugar nenhum da primeira tela.
 *
 * ── Ordenado por consequência, não por data ───────────────────────────────────────────────────
 * O que custa dinheiro ou chega ao cliente vem primeiro; o que é organização interna vem depois.
 * Ordenar por "mais recente" colocaria uma tarefa criada hoje acima de um cliente sem resposta há
 * duas semanas — e o mais novo quase nunca é o mais grave.
 *
 * ── Cada item diz DE ONDE veio ────────────────────────────────────────────────────────────────
 * O campo `fonte` existe para a pessoa poder conferir. Um cockpit que afirma sem dizer de onde tira
 * vira mais uma tela em que não se confia.
 */

export type Peso = "grave" | "atencao" | "normal";

export type ItemDoDia = {
  chave: string;
  peso: Peso;
  /** O que aconteceu, em uma frase, com o número que importa dentro dela. */
  achado: string;
  acao: string;
  href: string;
  fonte: string;
  metrica?: { valor: string; rotulo: string };
};

const ORDEM: Record<Peso, number> = { grave: 0, atencao: 1, normal: 2 };

export async function oQuePrecisaDeVoce(): Promise<ItemDoDia[]> {
  const sb = createServiceClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const itens: ItemDoDia[] = [];

  const [faturas, entregas, standby, conversas, rascunhos, tarefas, revisao, demandas] = await Promise.all([
    /**
     * Vencida é calculado pela DATA, não pelo campo `status`.
     *
     * O status só muda quando a sincronia com a ASAAS roda — e ela está apontada para o sandbox.
     * Confiar no campo faria a tela dizer "nenhuma fatura vencida" com uma vencida há semanas no
     * banco. A data não depende de integração nenhuma para estar certa.
     */
    sb.from("invoices").select("id, amount, due_date, org_id, status, organizations(name)")
      .is("paid_at", null).not("status", "in", "(paga,cancelada)").lt("due_date", hoje),
    sb.from("deliverables").select("id, title, due_date, org_id, organizations(name)")
      .is("deleted_at", null).is("delivered_at", null).lt("due_date", hoje),
    sb.from("projects").select("id, org_id, standby_desde, standby_motivo, organizations(name)")
      .not("standby_desde", "is", null),
    sb.from("rel_conversas").select("id", { count: "exact", head: true })
      .eq("triagem", "precisa_resposta").eq("status", "aberta").is("deleted_at", null),
    sb.from("rel_sugestoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    sb.from("tasks").select("id", { count: "exact", head: true })
      .eq("done", false).not("due_date", "is", null).lte("due_date", hoje),
    sb.from("studio_deliverables").select("id", { count: "exact", head: true }).eq("status", "em_revisao"),
    sb.from("legal_matters").select("id, titulo, prazo").is("concluida_em", null).lte("prazo", hoje),
  ]);

  // ── Dinheiro parado ─────────────────────────────────────────────────────────────────────────
  const vencidas = faturas.data ?? [];
  if (vencidas.length) {
    const total = vencidas.reduce((a, f) => a + Number(f.amount ?? 0), 0);
    const pior = vencidas.reduce((a, f) => Math.max(a, diasDeAtraso(f.due_date as string) ?? 0), 0);
    const nomes = [...new Set(vencidas.map((f) => (f.organizations as unknown as { name: string } | null)?.name ?? "cliente"))];
    itens.push({
      chave: "faturas_vencidas", peso: "grave",
      achado: `${vencidas.length} fatura(s) vencida(s) somando ${brl(total)} — a mais antiga há ${pior} dias (${nomes.join(", ")}).`,
      acao: "Abrir a cobrança", href: "/admin/financeiro",
      fonte: "Faturas com vencimento passado e sem pagamento registrado.",
      metrica: { valor: brl(total), rotulo: "em atraso" },
    });
  }

  // ── O que o cliente está esperando ──────────────────────────────────────────────────────────
  const atrasadas = entregas.data ?? [];
  if (atrasadas.length) {
    const pior = atrasadas.reduce((a, d) => Math.max(a, diasDeAtraso(d.due_date as string) ?? 0), 0);
    itens.push({
      chave: "entregas_atrasadas", peso: "grave",
      achado: `${atrasadas.length} entrega(s) passaram do prazo — a pior há ${pior} dias.`,
      acao: "Ver escopo e entregas", href: "/admin/entregas",
      fonte: "Entregas contratadas com prazo vencido e sem data de entrega.",
      metrica: { valor: String(atrasadas.length), rotulo: "atrasadas" },
    });
  }

  const conta = conversas.count ?? 0;
  if (conta) {
    itens.push({
      chave: "conversas_precisam", peso: "atencao",
      achado: `${conta} conversa(s) esperam resposta de uma pessoa — o resto da caixa é máquina.`,
      acao: "Abrir a caixa filtrada", href: "/admin/relacionamento?tri=precisa",
      fonte: "Triagem da caixa (remetente + conteúdo).",
      metrica: { valor: String(conta), rotulo: "para responder" },
    });
  }

  const pend = rascunhos.count ?? 0;
  if (pend) {
    itens.push({
      chave: "rascunhos_agente", peso: "atencao",
      achado: `${pend} resposta(s) já escritas pelo agente esperando você revisar e enviar.`,
      acao: "Revisar rascunhos", href: "/admin/relacionamento?tri=precisa",
      fonte: "Resposta assistida — nada sai sem aprovação.",
      metrica: { valor: String(pend), rotulo: "prontas" },
    });
  }

  // ── Prazo jurídico ──────────────────────────────────────────────────────────────────────────
  for (const d of demandas.data ?? []) {
    itens.push({
      chave: `juridico_${d.id}`, peso: "grave",
      achado: `Demanda jurídica "${d.titulo}" com prazo em ${dataBR(d.prazo as string)}.`,
      acao: "Abrir no Jurídico", href: "/admin/juridico",
      fonte: "Demandas com prazo vencido ou vencendo hoje.",
    });
  }

  // ── Interno ─────────────────────────────────────────────────────────────────────────────────
  const venc = tarefas.count ?? 0;
  if (venc) {
    itens.push({
      chave: "tarefas_vencidas", peso: "atencao",
      achado: `${venc} tarefa(s) vencida(s) pedindo follow-up.`,
      acao: "Ver tarefas", href: "/admin/tarefas",
      fonte: "Tarefas abertas com prazo até hoje.",
      metrica: { valor: String(venc), rotulo: "vencidas" },
    });
  }

  const rev = revisao.count ?? 0;
  if (rev) {
    itens.push({
      chave: "entregaveis_revisao", peso: "normal",
      achado: `${rev} entregável(is) aguardam sua aprovação antes de ir ao cliente.`,
      acao: "Revisar no Estúdio", href: "/admin/entregaveis",
      fonte: "Entregáveis do Estúdio com status em revisão.",
      metrica: { valor: String(rev), rotulo: "em revisão" },
    });
  }

  /**
   * Projeto parado não é uma ação — é um contexto que muda a leitura de tudo o mais.
   *
   * Vem por último de propósito: quem vê "entrega atrasada" precisa saber que o projeto está parado
   * antes de cobrar a equipe, mas o item em si não pede providência nenhuma hoje.
   */
  for (const p of standby.data ?? []) {
    const nome = (p.organizations as unknown as { name: string } | null)?.name ?? "cliente";
    const dias = diasDeAtraso(p.standby_desde as string) ?? 0;
    itens.push({
      chave: `standby_${p.id}`, peso: "normal",
      achado: `Projeto de ${nome} está parado há ${dias} dias — o relógio dos prazos está pausado.`,
      acao: "Ver o projeto", href: "/admin/entregas",
      fonte: "Projetos com stand-by ativo.",
    });
  }

  return itens.sort((a, b) => ORDEM[a.peso] - ORDEM[b.peso]);
}
