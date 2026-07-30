import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { registrarSinal } from "./engajamento";
import { slugDoPerfil } from "./linkedin";
import { mencoesDeIA } from "./afinidade-ia";

/**
 * Mensagens do LinkedIn do próprio André.
 *
 * ── Por que estas podem entrar, e as de terceiros não ────────────────────────────────────────
 * Ele é participante da conversa. Uma mensagem dirigida a ele é dado dele tanto quanto o e-mail
 * que a inbox já ingere há meses (`rel_mensagens`, 514 linhas). O que continua fora é conversa de
 * que ele não participa — isso exigiria credencial alheia e não é questão de risco calibrável.
 *
 * ── Mas a conversa tem duas pontas ────────────────────────────────────────────────────────────
 * Guardar a mensagem significa tratar o dado de QUEM ESCREVEU. É legítimo — a pessoa dirigiu a
 * comunicação a ele —, mas exige a mesma cobertura do resto: entra na exclusão do titular, conta
 * como sinal de engajamento e está no LIA. Não é um canto do sistema onde as regras não valem.
 *
 * ── Duas vias de entrada, e a primeira é melhor ───────────────────────────────────────────────
 *  1. **Exportação oficial do LinkedIn** (Configurações → Privacidade → Obter uma cópia dos seus
 *     dados → `messages.csv`). É o próprio LinkedIn entregando o dado. Sem raspagem, sem cookie,
 *     sem risco de conta. É o caminho recomendado.
 *  2. **Apify com sessão** — automático, mas carrega o risco que a raspagem carrega.
 */

export type MensagemBruta = {
  direcao: "recebida" | "enviada";
  perfilUrl?: string | null;
  nome: string;
  assunto?: string | null;
  corpo: string;
  enviadaEm?: string | null;
  conversaRef?: string | null;
};

export type ResultadoMensagens = {
  lidas: number; gravadas: number; repetidas: number; sobreIa: number; casadas: number;
};

/**
 * Lê o `messages.csv` da exportação oficial.
 *
 * Colunas que o LinkedIn entrega hoje: CONVERSATION ID, CONVERSATION TITLE, FROM, SENDER PROFILE
 * URL, TO, RECIPIENT PROFILE URLS, DATE, SUBJECT, CONTENT. O parser é tolerante a variação de
 * nome e ordem porque o formato já mudou antes e vai mudar de novo — o que ele nunca faz é
 * adivinhar: coluna que não reconhece vira nulo, não vira palpite.
 */
export function parsearCsvExportacao(csv: string, meuNome: string): { linhas: MensagemBruta[]; ignoradas: number } {
  const linhas: MensagemBruta[] = [];
  let ignoradas = 0;

  const registros = dividirCsv(csv);
  if (registros.length < 2) return { linhas, ignoradas };

  const cab = registros[0].map((c) => c.trim().toUpperCase());
  const col = (...nomes: string[]) => {
    for (const n of nomes) {
      const i = cab.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iDe = col("FROM", "SENDER", "DE");
  const iUrlDe = col("SENDER PROFILE URL", "FROM PROFILE URL");
  const iPara = col("TO", "RECIPIENT", "PARA");
  const iUrlPara = col("RECIPIENT PROFILE URLS", "TO PROFILE URL");
  const iData = col("DATE", "DATA", "SENT AT");
  const iAssunto = col("SUBJECT", "ASSUNTO", "CONVERSATION TITLE");
  const iCorpo = col("CONTENT", "MESSAGE", "BODY", "CONTEUDO");
  const iConversa = col("CONVERSATION ID", "CONVERSATIONID");

  if (iCorpo < 0) return { linhas, ignoradas: registros.length - 1 };

  const meu = meuNome.trim().toLowerCase();
  for (const r of registros.slice(1)) {
    const corpo = (r[iCorpo] ?? "").trim();
    if (!corpo) { ignoradas++; continue; }

    const de = (r[iDe] ?? "").trim();
    const para = (r[iPara] ?? "").trim();
    // Quem escreveu sou eu? Então é enviada; senão, recebida. Comparo pelo nome porque a
    // exportação não marca a direção — ela só diz quem é o remetente.
    const euEnviei = !!meu && de.toLowerCase().includes(meu);
    const outro = euEnviei ? para : de;
    const outroUrl = euEnviei ? (r[iUrlPara] ?? null) : (r[iUrlDe] ?? null);

    if (!outro) { ignoradas++; continue; }

    linhas.push({
      direcao: euEnviei ? "enviada" : "recebida",
      perfilUrl: (outroUrl ?? "").split(/[\s;,]+/)[0] || null,   // pode vir lista
      nome: outro,
      assunto: iAssunto >= 0 ? (r[iAssunto] ?? null) : null,
      corpo,
      enviadaEm: iData >= 0 ? normalizarData(r[iData]) : null,
      conversaRef: iConversa >= 0 ? (r[iConversa] ?? null) : null,
    });
  }
  return { linhas, ignoradas };
}

/** CSV com aspas e quebra de linha dentro de campo — mensagem tem parágrafo, então isto importa. */
function dividirCsv(texto: string): string[][] {
  const registros: string[][] = [];
  let campo = "", linha: string[] = [], dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === ",") { linha.push(campo); campo = ""; continue; }
    if (c === "\n") { linha.push(campo); registros.push(linha); linha = []; campo = ""; continue; }
    if (c === "\r") continue;
    campo += c;
  }
  if (campo || linha.length) { linha.push(campo); registros.push(linha); }
  return registros.filter((l) => l.some((c) => c.trim()));
}

function normalizarData(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Grava as mensagens, marca as que falam de IA e casa com a base.
 *
 * Só mensagem sobre IA vira SINAL. As outras ficam gravadas como histórico de relacionamento —
 * é o que o CRM já faz com e-mail —, mas não inflam o score de afinidade: alguém que trocou
 * mensagens sobre outro assunto não está, por isso, dentro do assunto.
 */
export async function ingerirMensagens(brutas: MensagemBruta[], fonte: "exportacao" | "apify" | "manual" = "exportacao"): Promise<ResultadoMensagens> {
  const sb = createServiceClient();
  const r: ResultadoMensagens = { lidas: brutas.length, gravadas: 0, repetidas: 0, sobreIa: 0, casadas: 0 };
  const sinalDado = new Set<string>();

  for (const m of brutas) {
    const slug = slugDoPerfil(m.perfilUrl);
    const temaIa = mencoesDeIA(`${m.assunto ?? ""} ${m.corpo}`) > 0;

    let prospectId: string | null = null;
    if (slug) {
      const { data: p } = await sb.from("prospects")
        .select("id, oposicao_em").ilike("linkedin_url", `%/in/${slug}%`).limit(1).maybeSingle();
      // Quem se opôs não é observado — nem pelo que escreveu para nós.
      if (p?.oposicao_em) continue;
      prospectId = (p?.id as string) ?? null;
    }

    const { error } = await sb.from("linkedin_mensagens").insert({
      conversa_ref: m.conversaRef ?? null,
      direcao: m.direcao,
      perfil_url: m.perfilUrl ?? null,
      perfil_slug: slug,
      nome: m.nome,
      assunto: m.assunto ?? null,
      corpo: m.corpo,
      tema_ia: temaIa,
      enviada_em: m.enviadaEm ?? null,
      prospect_id: prospectId,
      fonte,
    });

    if (error) {
      if (/duplicate|unique/i.test(error.message)) { r.repetidas++; continue; }
      console.error("[mensagens] falha ao gravar:", error.message);
      continue;
    }
    r.gravadas++;
    if (temaIa) r.sobreIa++;

    /**
     * O sinal é por PESSOA, não por mensagem. Uma conversa de vinte mensagens é um contato, não
     * vinte — contar cada uma colocaria quem conversou muito uma vez acima de quem responde
     * sempre.
     */
    if (prospectId && m.direcao === "recebida" && !sinalDado.has(prospectId)) {
      sinalDado.add(prospectId);
      await registrarSinal({
        tipo: temaIa ? "mensagem_sobre_ia" : "mensagem_recebida",
        prospectId, fonte: `linkedin_${fonte}`,
        detalhe: { assunto: m.assunto ?? null },
      });
      r.casadas++;
    }
  }

  // O conteúdo NÃO vai para a auditoria: o registro diz que houve ingestão e quanto, não o que
  // as pessoas escreveram.
  await auditService("linkedin.mensagens.ingeridas", "linkedin_mensagens", undefined, {
    lidas: r.lidas, gravadas: r.gravadas, sobre_ia: r.sobreIa, fonte,
  });
  return r;
}

/** Conversas sobre IA, do mais recente para o mais antigo — a leitura que interessa. */
export type ConversaLinha = {
  nome: string; perfilUrl: string | null; prospectId: string | null;
  mensagens: number; sobreIa: number; ultima: string | null; trecho: string | null;
};

export async function conversasSobreIa(limite = 30): Promise<ConversaLinha[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("linkedin_mensagens")
    .select("nome, perfil_url, perfil_slug, prospect_id, tema_ia, corpo, enviada_em, direcao")
    .order("enviada_em", { ascending: false, nullsFirst: false })
    .limit(600);

  const porPessoa = new Map<string, ConversaLinha>();
  for (const m of data ?? []) {
    const chave = (m.perfil_slug as string) ?? (m.nome as string);
    const atual = porPessoa.get(chave) ?? {
      nome: m.nome as string, perfilUrl: m.perfil_url as string | null,
      prospectId: m.prospect_id as string | null,
      mensagens: 0, sobreIa: 0, ultima: null, trecho: null,
    };
    atual.mensagens++;
    if (m.tema_ia) atual.sobreIa++;
    if (!atual.ultima && m.enviada_em) {
      atual.ultima = m.enviada_em as string;
      if (m.direcao === "recebida") atual.trecho = (m.corpo as string ?? "").slice(0, 140);
    }
    porPessoa.set(chave, atual);
  }

  return [...porPessoa.values()]
    .filter((c) => c.sobreIa > 0)
    .sort((a, b) => (b.ultima ?? "").localeCompare(a.ultima ?? ""))
    .slice(0, limite);
}
