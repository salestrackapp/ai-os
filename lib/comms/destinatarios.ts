import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Quem recebe cada passo da régua.
 *
 * ── O defeito que isto corrige ────────────────────────────────────────────────────────────────
 * O editor pergunta o público de cada passo — Cliente, Equipe do cliente, Admin — e mostra "para
 * cliente" na lista. O motor ignorava a resposta e mandava para TODOS os contatos da organização,
 * até duzentos. Uma tela que coleta uma decisão e um motor que a descarta é pior do que não ter a
 * decisão: quem configurou acredita que configurou.
 *
 * ── Por que ficar sem destinatário é um resultado legítimo ────────────────────────────────────
 * Se um passo é "só para o patrocinador" e a organização não tem patrocinador identificado, o certo
 * é NÃO enviar e dizer por quê. Cair para "manda para todo mundo" transformaria uma mensagem
 * dirigida numa circular — exatamente o erro que o campo existe para evitar.
 */

export type Destinatario = {
  contactId: string; nome?: string; email?: string; phone?: string; optIn: boolean;
  /** Por que este endereço pode receber. Vai para o registro de entrega, não para o e-mail. */
  base: "execucao_contrato" | "opt_in_whatsapp" | "equipe_interna";
};

export type Publico = "cliente" | "equipe_cliente" | "admin";

export type Resolucao = { destinatarios: Destinatario[]; motivo?: string };

/**
 * Quem responde pela organização do lado do cliente.
 *
 * Vem de `memberships`, não de `contacts.role` — o cargo em `contacts` é texto livre ("COO",
 * "Diretor de Operações") e não diz nada sobre quem patrocina o programa. O papel no sistema diz.
 */
const PAPEIS_DECISORES = ["sponsor", "client_admin"];

async function emailsDosDecisores(orgId: string): Promise<Set<string>> {
  const sb = createServiceClient();
  const { data: ms } = await sb.from("memberships")
    .select("user_id").eq("org_id", orgId).in("role", PAPEIS_DECISORES);
  if (!ms?.length) return new Set();

  const admin = createAdminClient();
  const emails = new Set<string>();
  for (const m of ms) {
    try {
      const { data } = await admin.auth.admin.getUserById(m.user_id as string);
      const e = data.user?.email?.toLowerCase();
      if (e) emails.add(e);
    } catch { /* um usuário que não resolve não pode derrubar a resolução dos outros */ }
  }
  return emails;
}

export async function resolverDestinatarios(
  orgId: string, publico: Publico, canal: "email" | "whatsapp",
): Promise<Resolucao> {
  const sb = createServiceClient();

  if (publico === "admin") {
    /**
     * Passo dirigido à equipe Salestrack. Não usa os contatos do cliente — usar seria mandar para o
     * cliente uma mensagem escrita para nós. O canal certo para avisar a equipe é a notificação, que
     * já existe; aqui a régua apenas não tem o que enfileirar.
     */
    return { destinatarios: [], motivo: "Passo dirigido à equipe Salestrack — use as notificações do sistema, não a régua do cliente." };
  }

  const { data: contatos } = await sb.from("contacts")
    .select("id, name, email, phone, opt_in_whatsapp")
    .eq("org_id", orgId).is("deleted_at", null).limit(200);

  const comEndereco = (contatos ?? []).filter((c) => (canal === "email" ? !!c.email : !!c.phone));
  if (!comEndereco.length) {
    return { destinatarios: [], motivo: `Nenhum contato desta organização tem ${canal === "email" ? "e-mail" : "telefone"} cadastrado.` };
  }

  let alvo = comEndereco;
  if (publico === "cliente") {
    const decisores = await emailsDosDecisores(orgId);
    alvo = comEndereco.filter((c) => c.email && decisores.has(String(c.email).toLowerCase()));
    if (!alvo.length) {
      return {
        destinatarios: [],
        motivo: "Este passo é só para quem patrocina o programa, e nenhum contato desta organização tem esse papel no sistema. Ajuste o público do passo ou o papel da pessoa em Equipe.",
      };
    }
  }

  /**
   * A base legal é declarada por canal, e não inventada.
   *
   * No e-mail de programa, a base é execução de contrato: a pessoa é do cliente e a mensagem é sobre
   * o serviço contratado — não é marketing, e não depende de opt-in. No WhatsApp, depende: o canal
   * é pessoal e exige aceite explícito, guardado em `contacts.opt_in_whatsapp`.
   */
  return {
    destinatarios: alvo.map((c) => ({
      contactId: c.id as string,
      nome: (c.name as string) ?? undefined,
      email: (c.email as string) ?? undefined,
      phone: (c.phone as string) ?? undefined,
      optIn: canal === "whatsapp" ? !!c.opt_in_whatsapp : true,
      base: canal === "whatsapp" ? "opt_in_whatsapp" : "execucao_contrato",
    })),
  };
}
