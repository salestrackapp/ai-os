import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { currentMembership } from "@/lib/auth";

/**
 * Acesso ao banco de RH — que é OUTRO projeto Supabase.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * O QUE O ISOLAMENTO PROTEGE, E O QUE NÃO PROTEGE
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Protege contra: falha de política RLS no AI OS, vazamento de dump do AI OS, e acesso pela chave
 * anônima do AI OS. Nenhum desses caminhos alcança dados de pessoal — eles estão em outro banco,
 * com outras credenciais.
 *
 * NÃO protege contra: comprometimento do servidor do AI OS. Quem executar código aqui tem a chave
 * de serviço do RH. Isso é inerente a qualquer arquitetura em que uma aplicação lê dois bancos, e
 * é melhor dizer do que fingir que a separação resolve tudo.
 *
 * ── Quem é do RH mora NO BANCO DE RH ──────────────────────────────────────────────────────────
 * `rh_papeis` é a fonte da verdade, e ela vive lá. Conceder acesso ao RH exige escrever no banco
 * de RH — não basta mexer numa tabela do AI OS. Se o papel morasse aqui, um admin do AI OS se
 * daria acesso a folha de pagamento sozinho, e a separação viraria decoração.
 *
 * ── A chave de cifra ──────────────────────────────────────────────────────────────────────────
 * `RH_ENCRYPTION_KEY` e `RH_CPF_SALT` são definidas por sessão de banco, via GUC. Sem elas, as
 * funções de decifra lançam exceção — então uma configuração pela metade não devolve dado em
 * claro por engano: ela falha, que é o comportamento certo.
 */

export type PapelRh = "rh_admin" | "rh_gestor" | "rh_leitura";

export function rhConfigurado(): boolean {
  return !!(process.env.RH_SUPABASE_URL && process.env.RH_SERVICE_ROLE_KEY);
}

/** Cliente de serviço do RH. Nunca exposto ao cliente — só Server Actions e Server Components. */
export function rhClient(): SupabaseClient {
  const url = process.env.RH_SUPABASE_URL;
  const key = process.env.RH_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("O banco de RH não está configurado. Ver docs/CONFIG_PENDENTE.md, item do RH.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Abre uma sessão com a chave de cifra definida.
 *
 * O GUC vale para a conexão, e o pool do Supabase reaproveita conexões — então a chave é definida
 * a cada operação que precisa dela, não uma vez no boot. Definir uma vez e torcer é como se
 * descobre, semanas depois, que metade das leituras devolveu nulo.
 */
export async function comChaveDeCifra<T>(fn: (sb: SupabaseClient) => Promise<T>): Promise<T> {
  const sb = rhClient();
  const chave = process.env.RH_ENCRYPTION_KEY;
  const sal = process.env.RH_CPF_SALT;
  if (!chave || !sal) {
    throw new Error("As chaves de cifra do RH não estão configuradas — sem elas nenhum dado protegido é lido ou gravado.");
  }
  const { error } = await sb.rpc("rh_definir_chave", { p_chave: chave, p_sal: sal });
  if (error) throw new Error(`Não foi possível abrir a sessão cifrada do RH: ${error.message}`);
  return fn(sb);
}

export type AcessoRh = { permitido: boolean; papel: PapelRh | null; email: string; motivo?: string };

/**
 * Descobre o papel de RH de quem está logado no AI OS.
 *
 * O elo é o E-MAIL: quem está logado aqui precisa constar em `rh_papeis` lá. Ser admin do AI OS
 * não dá acesso ao RH — de propósito. A pessoa que administra o CRM não é necessariamente a que
 * pode ver folha de pagamento, e tratar as duas como a mesma coisa é como um sistema de RH vaza.
 */
export async function acessoRh(): Promise<AcessoRh> {
  const m = await currentMembership();
  const email = m?.email ?? "";
  if (!email) return { permitido: false, papel: null, email: "", motivo: "Sessão sem e-mail." };
  if (!rhConfigurado()) {
    return { permitido: false, papel: null, email, motivo: "O banco de RH ainda não foi configurado." };
  }

  try {
    const sb = rhClient();
    const { data } = await sb.from("rh_papeis")
      .select("papel, ativo").ilike("email", email).eq("ativo", true).maybeSingle();
    if (!data) {
      return {
        permitido: false, papel: null, email,
        motivo: "Você não tem acesso ao RH. O acesso é concedido dentro do próprio banco de RH — ser admin do AI OS não basta.",
      };
    }
    return { permitido: true, papel: data.papel as PapelRh, email };
  } catch (e) {
    return { permitido: false, papel: null, email, motivo: (e as Error).message };
  }
}

export async function exigirRh(minimo: PapelRh = "rh_leitura"): Promise<AcessoRh> {
  const a = await acessoRh();
  if (!a.permitido) throw new Error(a.motivo ?? "Sem acesso ao RH.");
  const ordem: PapelRh[] = ["rh_leitura", "rh_gestor", "rh_admin"];
  if (ordem.indexOf(a.papel!) < ordem.indexOf(minimo)) {
    throw new Error(`Esta ação exige papel ${minimo}. O seu é ${a.papel}.`);
  }
  return a;
}

/**
 * Registra no banco de RH quem leu o quê.
 *
 * Como o AI OS usa a chave de serviço, o `auth.uid()` do banco de RH é nulo — então o ator vem
 * daqui, pelo e-mail. Sem isso a trilha diria "alguém leu", que é o mesmo que não dizer nada.
 */
export async function auditarRh(opts: {
  acao: string; recurso: string; employeeId?: string | null; detalhe?: Record<string, unknown>;
}): Promise<void> {
  try {
    const a = await acessoRh();
    const sb = rhClient();
    await sb.from("rh_audit").insert({
      acao: opts.acao, recurso: opts.recurso, employee_id: opts.employeeId ?? null,
      detalhe: { ...(opts.detalhe ?? {}), ator_email: a.email, via: "ai-os" },
    });
  } catch (e) {
    console.error("[rh] auditoria falhou:", (e as Error).message);
  }
}
