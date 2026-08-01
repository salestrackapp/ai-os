import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { OPERACOES, OPERADORES, type BaseLegal } from "./registro-conteudo";

/**
 * Leitura e semeadura do registro de operações de tratamento.
 *
 * ── Quem lê o quê ────────────────────────────────────────────────────────────────────────────
 * A página pública usa `lerRegistro()`, que fala com o banco pelo cliente NORMAL, sob RLS. Dá
 * certo porque `tratamento_operacoes` tem policy de select para `anon`: o conteúdo É público, e
 * usar service role para exibir texto que qualquer um pode ler seria trocar uma chave sem poder
 * nenhum por uma chave com poder de ler tudo.
 */

export type OperacaoRegistro = {
  chave: string; nome: string; finalidade: string; baseLegal: BaseLegal;
  titulares: string; dados: string; origem: string;
  compartilhamento: string | null; retencao: string;
  ondeNoSistema: string | null; observacao: string | null;
};

export type OperadorRegistro = {
  chave: string; nome: string; papel: string; dados: string; pais: string; site: string | null;
};

export type Registro = { operacoes: OperacaoRegistro[]; operadores: OperadorRegistro[] };

export async function lerRegistro(): Promise<Registro> {
  const sb = await createClient();

  const [{ data: ops }, { data: opers }] = await Promise.all([
    sb.from("tratamento_operacoes")
      .select("chave, nome, finalidade, base_legal, titulares, dados, origem, compartilhamento, retencao, onde_no_sistema, observacao")
      .eq("ativo", true).order("ordem"),
    sb.from("tratamento_operadores")
      .select("chave, nome, papel, dados, pais, site").eq("ativo", true).order("ordem"),
  ]);

  return {
    operacoes: (ops ?? []).map((o) => ({
      chave: o.chave as string, nome: o.nome as string, finalidade: o.finalidade as string,
      baseLegal: o.base_legal as BaseLegal, titulares: o.titulares as string, dados: o.dados as string,
      origem: o.origem as string, compartilhamento: (o.compartilhamento as string) ?? null,
      retencao: o.retencao as string, ondeNoSistema: (o.onde_no_sistema as string) ?? null,
      observacao: (o.observacao as string) ?? null,
    })),
    operadores: (opers ?? []).map((o) => ({
      chave: o.chave as string, nome: o.nome as string, papel: o.papel as string,
      dados: o.dados as string, pais: o.pais as string, site: (o.site as string) ?? null,
    })),
  };
}

/**
 * Grava a semente no banco, sem apagar edição feita na tela.
 *
 * `upsert` por `chave`, e não "limpa e reinsere": o registro é editável em produção justamente
 * para que corrigir uma frase não dependa de deploy, e um seed destrutivo desfaria essa correção
 * silenciosamente na próxima execução. Linha que existe só no banco (criada pela tela) sobrevive.
 */
export async function semearRegistro(): Promise<{ operacoes: number; operadores: number }> {
  const sb = createServiceClient();
  const agora = new Date().toISOString();

  const { error: e1 } = await sb.from("tratamento_operacoes").upsert(
    OPERACOES.map((o) => ({
      chave: o.chave, ordem: o.ordem, ativo: true, nome: o.nome, finalidade: o.finalidade,
      base_legal: o.baseLegal, titulares: o.titulares, dados: o.dados, origem: o.origem,
      compartilhamento: o.compartilhamento ?? null, retencao: o.retencao,
      onde_no_sistema: o.ondeNoSistema ?? null, observacao: o.observacao ?? null, updated_at: agora,
    })),
    { onConflict: "chave" },
  );
  if (e1) throw new Error(`operações: ${e1.message}`);

  const { error: e2 } = await sb.from("tratamento_operadores").upsert(
    OPERADORES.map((o) => ({
      chave: o.chave, ordem: o.ordem, ativo: !o.inativo, nome: o.nome, papel: o.papel,
      dados: o.dados, pais: o.pais, site: o.site ?? null, updated_at: agora,
    })),
    { onConflict: "chave" },
  );
  if (e2) throw new Error(`operadores: ${e2.message}`);

  return { operacoes: OPERACOES.length, operadores: OPERADORES.filter((o) => !o.inativo).length };
}
