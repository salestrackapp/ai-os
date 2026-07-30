import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { auditService } from "@/lib/audit";
import { registrarSinal } from "./engajamento";

/**
 * Sinais de engajamento vindos do LinkedIn — dos posts do PRÓPRIO André.
 *
 * ── Por que só dos posts dele ─────────────────────────────────────────────────────────────────
 * Quem curte ou comenta um post do André sobre IA declara duas coisas de uma vez: que o tema
 * interessa, e que já conhece quem escreveu. Para o objetivo — achar quem "está dentro do
 * assunto" — é o sinal mais forte disponível, e é dado do próprio André: o post é dele, a lista
 * de quem reagiu é dele, o LinkedIn a exibe para ele.
 *
 * O que NÃO é obtido por aqui, e não é limitação de implementação:
 *  · curtidas da pessoa em posts de terceiros — nenhuma API expõe; só raspando
 *  · participação em grupos — não é exposto por API nem publicamente
 *  · mensagens privadas — comunicação privada, sem base legal possível
 *
 * ── Como o dado entra ─────────────────────────────────────────────────────────────────────────
 * Duas vias, de propósito:
 *  1. `ingerirColagem` — o André copia a lista de reações/comentários do post e cola. Funciona
 *     HOJE, sem depender de aprovação de app.
 *  2. `ingerirDaApi` — a Community Management API oficial, quando o app estiver aprovado. A
 *     ingestão é a mesma; só muda quem entrega as linhas.
 *
 * ── O elo que faz isso funcionar ──────────────────────────────────────────────────────────────
 * O Apollo já traz `linkedin_url` de cada prospect. A interação também traz a URL do perfil. O
 * SLUG (`/in/alguem`) é o que casa as duas pontas com segurança — nome + empresa erraria, porque
 * homônimo existe e empresa muda.
 */

export type InteracaoBruta = {
  tipo: "curtida" | "comentario" | "compartilhamento";
  perfilUrl?: string | null;
  nome: string;
  cargo?: string | null;
  empresa?: string | null;
  texto?: string | null;
};

/** Peso do sinal de LinkedIn. Comentar exige escrever algo; curtir é um clique. */
const TIPO_SINAL = {
  curtida: "curtiu_post_ia",
  comentario: "comentou_post_ia",
  compartilhamento: "compartilhou_post_ia",
} as const;

export function slugDoPerfil(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.toLowerCase().replace(/^.*\/in\//, "").replace(/[/?#].*$/, "").trim();
  return s || null;
}

/**
 * Reconhece um perfil dentro do texto que o LinkedIn dá ao copiar a lista de reações.
 *
 * O formato colado varia com o idioma da interface e com o navegador, então o parser é
 * deliberadamente tolerante: aceita linhas com URL, linhas "Nome — Cargo na Empresa" e a forma
 * que o LinkedIn em português produz. O que ele NUNCA faz é inventar: linha que não bate vira
 * nada, e o número de ignoradas é devolvido para a tela mostrar.
 */
export function parsearColagem(bruto: string, tipoPadrao: InteracaoBruta["tipo"] = "curtida"): {
  linhas: InteracaoBruta[]; ignoradas: number;
} {
  const linhas: InteracaoBruta[] = [];
  let ignoradas = 0;
  const vistos = new Set<string>();

  for (const linhaBruta of bruto.split(/\r?\n/)) {
    const l = linhaBruta.trim();
    if (!l) continue;
    // Ruído comum do copiar-e-colar do LinkedIn.
    if (/^(ver perfil|view profile|conectar|connect|seguir|follow|·|\d+[°º])$/i.test(l)) continue;

    const url = l.match(/https?:\/\/[^\s]*linkedin\.com\/in\/[^\s,;]+/i)?.[0] ?? null;
    // "Nome — Cargo na Empresa" / "Nome - Cargo at Empresa" / "Nome | Cargo"
    const semUrl = l.replace(url ?? "", "").replace(/\s{2,}/g, " ").trim();
    const m = semUrl.match(/^([^—\-|,]{2,80})[—\-|,]\s*(.+)$/);
    const nome = (m?.[1] ?? semUrl).trim();
    const resto = (m?.[2] ?? "").trim();

    /**
     * Linha que é SÓ a URL do perfil é a melhor de todas — traz o slug, que é a chave de
     * casamento. Descartá-la por não ter nome legível seria jogar fora o dado mais útil; o nome
     * vira o slug legível até que o Apollo, no casamento, traga o nome real.
     */
    const chave = slugDoPerfil(url) ?? nome.toLowerCase();
    if (chave && vistos.has(chave)) continue;
    if (chave) vistos.add(chave);

    if ((!nome || nome.length < 2 || /^https?:/i.test(nome)) && url) {
      const slug = slugDoPerfil(url)!;
      linhas.push({
        tipo: tipoPadrao, perfilUrl: url,
        nome: slug.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        cargo: null, empresa: null, texto: null,
      });
      continue;
    }
    if (!nome || nome.length < 2 || /^https?:/i.test(nome)) { ignoradas++; continue; }

    const cargoEmpresa = resto.match(/^(.*?)\s+(?:na|no|at|@|em)\s+(.+)$/i);

    linhas.push({
      tipo: tipoPadrao,
      perfilUrl: url,
      nome,
      cargo: (cargoEmpresa?.[1] ?? resto) || null,
      empresa: cargoEmpresa?.[2] ?? null,
      texto: null,
    });
  }
  return { linhas, ignoradas };
}

export type ResultadoIngestao = {
  gravadas: number; casadas: number; repetidas: number; ignoradas: number;
};

/**
 * Grava as interações de um post e casa com a base de prospecção.
 *
 * Quem não casa **fica gravado assim mesmo**, sem prospect. Essas linhas são justamente as mais
 * valiosas: gente interessada em IA que ainda não está na nossa base. A tela mostra essa fila
 * separada, para virar prospect com um clique.
 */
export async function ingerirInteracoes(postId: string, brutas: InteracaoBruta[], fonte = "manual"): Promise<ResultadoIngestao> {
  const sb = createServiceClient();
  const r: ResultadoIngestao = { gravadas: 0, casadas: 0, repetidas: 0, ignoradas: 0 };

  const { data: post } = await sb.from("linkedin_posts").select("id, tema_ia, titulo").eq("id", postId).maybeSingle();
  if (!post) return r;

  for (const b of brutas) {
    const slug = slugDoPerfil(b.perfilUrl);
    const { data: existente } = slug
      ? await sb.from("linkedin_interacoes").select("id")
          .eq("post_id", postId).eq("perfil_slug", slug).eq("tipo", b.tipo).maybeSingle()
      : { data: null };
    if (existente) { r.repetidas++; continue; }

    // Casamento pelo slug do perfil — a única chave confiável entre LinkedIn e Apollo.
    let prospectId: string | null = null;
    if (slug) {
      const { data: p } = await sb.from("prospects")
        .select("id, linkedin_url").not("linkedin_url", "is", null).ilike("linkedin_url", `%/in/${slug}%`).limit(1).maybeSingle();
      prospectId = (p?.id as string) ?? null;
    }

    const { error } = await sb.from("linkedin_interacoes").insert({
      post_id: postId, tipo: b.tipo, perfil_url: b.perfilUrl ?? null, perfil_slug: slug,
      nome: b.nome, cargo: b.cargo ?? null, empresa: b.empresa ?? null, texto: b.texto ?? null,
      prospect_id: prospectId, casado_em: prospectId ? new Date().toISOString() : null, fonte,
    });
    if (error) { r.ignoradas++; continue; }
    r.gravadas++;

    if (prospectId) {
      r.casadas++;
      // Só posts de tema IA viram sinal de afinidade. Curtir um post de fim de ano não diz nada
      // sobre estar dentro do assunto.
      if (post.tema_ia) {
        await registrarSinal({
          tipo: TIPO_SINAL[b.tipo], prospectId, fonte: "linkedin",
          detalhe: { post: post.titulo, perfil: b.perfilUrl },
        });
      }
    }
  }

  await sb.from("linkedin_posts").update({
    reacoes: (await contar(postId, "curtida")) + (await contar(postId, "compartilhamento")),
    comentarios: await contar(postId, "comentario"),
  }).eq("id", postId);

  await auditService("linkedin.interacoes.ingeridas", "linkedin_posts", postId, { ...r, fonte });
  return r;
}

async function contar(postId: string, tipo: string): Promise<number> {
  const sb = createServiceClient();
  const { count } = await sb.from("linkedin_interacoes")
    .select("id", { count: "exact", head: true }).eq("post_id", postId).eq("tipo", tipo);
  return count ?? 0;
}

/**
 * Recasa interações órfãs com prospects que entraram DEPOIS.
 *
 * Sem isto, quem curtiu um post em maio e só foi coletado pelo Apollo em julho ficaria para
 * sempre sem o sinal — e é exatamente essa pessoa que interessa: demonstrou interesse antes mesmo
 * de a gente saber que ela existia.
 */
export async function recasarOrfas(limite = 500): Promise<number> {
  const sb = createServiceClient();
  const { data: orfas } = await sb.from("linkedin_interacoes")
    .select("id, tipo, perfil_slug, post_id, linkedin_posts(tema_ia, titulo)")
    .is("prospect_id", null).not("perfil_slug", "is", null).limit(limite);

  let casadas = 0;
  for (const o of orfas ?? []) {
    const { data: p } = await sb.from("prospects")
      .select("id").ilike("linkedin_url", `%/in/${o.perfil_slug}%`).limit(1).maybeSingle();
    if (!p) continue;
    await sb.from("linkedin_interacoes")
      .update({ prospect_id: p.id, casado_em: new Date().toISOString() }).eq("id", o.id);
    const post = o.linkedin_posts as unknown as { tema_ia: boolean; titulo: string } | null;
    if (post?.tema_ia) {
      await registrarSinal({
        tipo: TIPO_SINAL[o.tipo as keyof typeof TIPO_SINAL] ?? "curtiu_post_ia",
        prospectId: p.id as string, fonte: "linkedin",
        detalhe: { post: post.titulo, recasado: true },
      });
    }
    casadas++;
  }
  if (casadas) await auditService("linkedin.interacoes.recasadas", "linkedin_interacoes", undefined, { casadas });
  return casadas;
}

/**
 * Ingestão pela API oficial do LinkedIn (Community Management API).
 *
 * Ainda não ativa: depende de app aprovado no LinkedIn Developers com o produto Community
 * Management, OAuth do André e a página de empresa vinculada. Enquanto isso não existe, devolve
 * `null` e a ingestão manual segue sendo o caminho — de propósito, para que a ausência da
 * credencial não pareça uma falha silenciosa.
 *
 * Quando a credencial existir, só esta função muda: `ingerirInteracoes` recebe as mesmas linhas.
 */
export async function ingerirDaApi(_postUrn: string): Promise<InteracaoBruta[] | null> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) return null;
  // Implementar com GET /rest/socialActions/{urn}/likes e /comments quando o app for aprovado.
  return null;
}
