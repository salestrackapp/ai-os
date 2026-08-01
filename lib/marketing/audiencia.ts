import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Quem pode receber esta campanha — e por que quem ficou de fora ficou.
 *
 * ── A lista NÃO é a base de contatos ──────────────────────────────────────────────────────────
 * A audiência de marketing sai de `consent_records`, não de `contacts`. É uma inversão deliberada:
 * a pergunta certa não é "quem eu conheço?" e sim "quem me autorizou?". Montar a lista a partir dos
 * contatos e depois filtrar consentimento faz o número grande aparecer primeiro na tela — e número
 * grande na tela é justamente o que faz alguém procurar um jeito de contornar o filtro.
 *
 * ── Três portões, todos no momento do envio ───────────────────────────────────────────────────
 * 1. Consentimento de marketing vigente, dado pelo próprio titular.
 * 2. `fn_pode_marketing`: barra quem tem procedência de coleta pública ou de terceiro, mesmo que
 *    exista um registro de consentimento — dado de prospecção não vira lista de marketing.
 * 3. Supressão: bounce duro ou reclamação de spam. Fato externo, não decisão da pessoa.
 *
 * Os três são reavaliados a cada disparo. Uma lista montada ontem não autoriza um envio hoje.
 */

export type Segmento = {
  /** null = todos que consentiram. */
  origem?: string | null;
  /** "clientes" = ligados a uma organização; "leads" = ainda não; null = tanto faz. */
  vinculo?: "clientes" | "leads" | null;
  /** Só quem abriu algum e-mail nos últimos N dias. */
  abriuNosUltimosDias?: number | null;
};

export type Destinatario = {
  email: string;
  nome: string | null;
  nomeCompleto: string | null;
  empresa: string | null;
  contactId: string | null;
};

export type Excluido = { email: string; motivo: string };

export type Audiencia = {
  destinatarios: Destinatario[];
  excluidos: Excluido[];
  /** Origens presentes na base consentida, para a tela montar o filtro sem inventar opções. */
  origens: { origem: string; total: number }[];
};

const primeiroNome = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || null;

export async function montarAudiencia(seg: Segmento = {}): Promise<Audiencia> {
  const sb = createServiceClient();

  // 1) A base: quem consentiu marketing e não revogou.
  const { data: consentidos } = await sb.from("consent_records")
    .select("email, origem, contact_id")
    .eq("finalidade", "marketing").eq("estado", "concedido").not("email", "is", null);

  const porEmail = new Map<string, { origem: string | null; contactId: string | null }>();
  for (const c of consentidos ?? []) {
    const e = String(c.email).trim().toLowerCase();
    if (!e) continue;
    // Mesmo e-mail com dois registros: o que tiver contato vinculado é o mais informativo.
    const atual = porEmail.get(e);
    if (!atual || (!atual.contactId && c.contact_id)) {
      porEmail.set(e, { origem: (c.origem as string) ?? null, contactId: (c.contact_id as string) ?? null });
    }
  }

  const origens = [...porEmail.values()].reduce<Record<string, number>>((acc, v) => {
    const k = v.origem ?? "sem origem";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  if (!porEmail.size) {
    return { destinatarios: [], excluidos: [], origens: [] };
  }

  const emails = [...porEmail.keys()];

  // 2) Supressão e dados do contato, em duas consultas em vez de duas por pessoa.
  const [{ data: suprimidos }, { data: contatos }] = await Promise.all([
    sb.from("email_supressao").select("email, motivo").in("email", emails),
    sb.from("contacts").select("id, name, email, org_id, organizations(name)").in("email", emails).is("deleted_at", null),
  ]);

  const supressao = new Map((suprimidos ?? []).map((s) => [String(s.email).toLowerCase(), s.motivo as string]));
  const contato = new Map((contatos ?? []).map((c) => [String(c.email).toLowerCase(), c]));

  // 3) Abertura recente, só quando o segmento pede.
  let abriram: Set<string> | null = null;
  if (seg.abriuNosUltimosDias) {
    const desde = new Date(Date.now() - seg.abriuNosUltimosDias * 86400000).toISOString();
    const { data } = await sb.from("email_envios")
      .select("email").not("aberto_em", "is", null).gte("aberto_em", desde);
    abriram = new Set((data ?? []).map((r) => String(r.email).toLowerCase()));
  }

  const destinatarios: Destinatario[] = [];
  const excluidos: Excluido[] = [];

  for (const [email, info] of porEmail) {
    const motivoSupressao = supressao.get(email);
    if (motivoSupressao) {
      excluidos.push({ email, motivo: motivoSupressao === "bounce_duro" ? "E-mail não existe ou recusou a entrega." : motivoSupressao === "reclamacao" ? "Marcou um envio nosso como spam." : "Bloqueado manualmente." });
      continue;
    }

    /**
     * O portão da procedência, consultado no banco.
     *
     * Poderia ser recalculado aqui em TypeScript, mas a regra já existe como função no Postgres e é
     * a mesma que a prospecção usa. Duas cópias de uma regra jurídica divergem — e a que diverge
     * silenciosamente é sempre a que autoriza a mais.
     */
    const { data: pode } = await sb.rpc("fn_pode_marketing", { p_email: email });
    if (!pode) {
      excluidos.push({ email, motivo: "Dado veio de coleta pública ou de terceiro — não pode ser usado para marketing." });
      continue;
    }

    if (seg.origem && (info.origem ?? "sem origem") !== seg.origem) continue;

    const c = contato.get(email);
    const temOrg = !!c?.org_id;
    if (seg.vinculo === "clientes" && !temOrg) continue;
    if (seg.vinculo === "leads" && temOrg) continue;
    if (abriram && !abriram.has(email)) continue;

    const nomeCompleto = (c?.name as string) ?? null;
    destinatarios.push({
      email,
      nome: primeiroNome(nomeCompleto),
      nomeCompleto,
      empresa: (c?.organizations as unknown as { name: string } | null)?.name ?? null,
      contactId: (c?.id as string) ?? info.contactId,
    });
  }

  return {
    destinatarios,
    excluidos,
    origens: Object.entries(origens).map(([origem, total]) => ({ origem, total })).sort((a, b) => b.total - a.total),
  };
}

/** Bloqueia um endereço para sempre. Chamado pelo webhook do Resend e à mão pela tela. */
export async function suprimir(email: string, motivo: "bounce_duro" | "reclamacao" | "manual", detalhe?: string, campanhaId?: string | null): Promise<void> {
  const sb = createServiceClient();
  await sb.from("email_supressao").upsert(
    { email: email.trim().toLowerCase(), motivo, detalhe: detalhe ?? null, campanha_id: campanhaId ?? null },
    { onConflict: "email" },
  );
}
