"use client";
/**
 * Sinais de IA vindos do LinkedIn.
 *
 * A tela precisa dizer, sem que ninguém pergunte, DE ONDE vem cada coisa — porque a diferença
 * entre "os posts do André" e "o LinkedIn inteiro" é a diferença entre um sistema que se sustenta
 * e um que arrisca a conta de quem o usa.
 *
 * Duas filas, e a segunda é a que importa mais:
 *  · quem já está na base e interagiu → o sinal entra no score na hora
 *  · quem interagiu e NÃO está na base → é gente interessada em IA que o Apollo não trouxe
 */
import { useState, useTransition } from "react";
import { dataBR } from "@/lib/formato/data";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { salvarPost, ingerirColagem, recasar, virarProspect } from "@/app/admin/prospeccao/sinais-linkedin/actions";

export type PostLinha = {
  id: string; titulo: string; url: string | null; temaIa: boolean;
  publicadoEm: string | null; reacoes: number; comentarios: number;
};

export type InteracaoLinha = {
  id: string; post: string; tipo: string; nome: string; cargo: string | null;
  empresa: string | null; perfilUrl: string | null; quando: string;
  prospectId: string | null;
};

const TIPO_ROTULO: Record<string, string> = {
  curtida: "curtiu", comentario: "comentou", compartilhamento: "compartilhou",
  post_proprio: "publicou", mencao: "mencionou",
};

const data = dataBR;   // trata coluna `date` sem deixar o fuso puxar o dia para trás

export function SinaisLinkedIn({ posts, naBase, foraDaBase }: {
  posts: PostLinha[]; naBase: InteracaoLinha[]; foraDaBase: InteracaoLinha[];
}) {
  const [novoPost, setNovoPost] = useState({ url: "", titulo: "", temaIa: true, publicadoEm: "" });
  const [abrindoPost, setAbrindoPost] = useState(false);
  const [colagem, setColagem] = useState({ postId: posts[0]?.id ?? "", tipo: "curtida" as const, texto: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  /**
   * `revalidatePath` na Server Action invalida o cache do servidor, mas não força ESTA árvore a
   * re-renderizar — os números do topo continuavam mostrando o estado anterior enquanto a mensagem
   * dizia que tinha dado certo. Quem opera lê os dois e conclui que falhou. `router.refresh()`
   * puxa o RSC atualizado; sem ele, a confirmação e a tela se contradizem.
   */
  const rodar = (fn: () => Promise<unknown>, ok?: string) => {
    setErro(null); setAviso(null);
    iniciar(async () => {
      try { const r = await fn(); setAviso(typeof r === "string" ? r : ok ?? null); }
      catch (e) { setErro((e as Error).message); }
      finally { router.refresh(); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi value={String(posts.filter((p) => p.temaIa).length)} label="Posts sobre IA acompanhados" />
        <Kpi value={String(naBase.length)} label="Pessoas da base que interagiram" />
        <Kpi value={String(foraDaBase.length)} label="Interessados fora da base" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/* ── Posts ──────────────────────────────────────────────────────────── */}
      {abrindoPost ? (
        <Card title="Novo post para acompanhar">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" hint="Como você reconhece esse post.">
              {(p) => <Input {...p} value={novoPost.titulo} onChange={(e) => setNovoPost({ ...novoPost, titulo: e.target.value })}
                placeholder="Ex.: Por que agentes de IA falham em processos comerciais" />}
            </Field>
            <Field label="Link do post" hint="Opcional — só para você reabrir depois.">
              {(p) => <Input {...p} value={novoPost.url} onChange={(e) => setNovoPost({ ...novoPost, url: e.target.value })} />}
            </Field>
            <Field label="Publicado em">
              {(p) => <Input {...p} type="date" value={novoPost.publicadoEm}
                onChange={(e) => setNovoPost({ ...novoPost, publicadoEm: e.target.value })} />}
            </Field>
            <Field label="É sobre IA?"
              hint="Só post de IA gera sinal de afinidade. Curtir um post de fim de ano não diz nada sobre o assunto.">
              {(p) => <Select {...p} value={novoPost.temaIa ? "sim" : "nao"}
                onChange={(e) => setNovoPost({ ...novoPost, temaIa: e.target.value === "sim" })}>
                <option value="sim">Sim — gera sinal</option>
                <option value="nao">Não — só registra a interação</option>
              </Select>}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await salvarPost(novoPost);
                setAbrindoPost(false); setNovoPost({ url: "", titulo: "", temaIa: true, publicadoEm: "" });
              }, "Post adicionado.")}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setAbrindoPost(false)}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setAbrindoPost(true)}>Adicionar post</Button>
      )}

      {/* ── Colagem ────────────────────────────────────────────────────────── */}
      {posts.length > 0 && (
        <Card title="Trazer quem interagiu">
          <p className="ds-small mb-4">
            No LinkedIn, abra a lista de quem reagiu ao post, selecione e copie. Cole aqui — uma
            pessoa por linha. O sistema reconhece nome, cargo, empresa e link do perfil, e casa
            sozinho com quem já está na base.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Post">
              {(p) => <Select {...p} value={colagem.postId} onChange={(e) => setColagem({ ...colagem, postId: e.target.value })}>
                {posts.map((po) => <option key={po.id} value={po.id}>{po.titulo}</option>)}
              </Select>}
            </Field>
            <Field label="Tipo de interação">
              {(p) => <Select {...p} value={colagem.tipo}
                onChange={(e) => setColagem({ ...colagem, tipo: e.target.value as typeof colagem.tipo })}>
                <option value="curtida">Curtiram</option>
                <option value="comentario">Comentaram</option>
                <option value="compartilhamento">Compartilharam</option>
              </Select>}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Cole a lista aqui">
              {(p) => <Textarea {...p} rows={6} value={colagem.texto}
                onChange={(e) => setColagem({ ...colagem, texto: e.target.value })}
                placeholder={"Ana Prado — Diretora de Operações na Indústria XYZ\nhttps://www.linkedin.com/in/joaosilva\nCarlos Lima - Head of Data at Fintech ABC"} />}
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                const msg = await ingerirColagem(colagem);
                setColagem({ ...colagem, texto: "" });
                return msg;
              })}>
              Trazer para a base
            </Button>
            <Button variant="ghost" loading={pendente} onClick={() => rodar(() => recasar())}>
              Casar com quem entrou depois
            </Button>
          </div>
        </Card>
      )}

      {/* ── Fora da base: a fila que mais importa ──────────────────────────── */}
      <Card className="p-0">
        <div className="border-b border-hairline px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
            Interessados em IA que ainda não estão na base
          </p>
          <p className="ds-small mt-1">
            Interagiram com o seu conteúdo por conta própria. É a lista mais qualificada que existe
            — ninguém aqui foi comprado nem coletado por filtro.
          </p>
        </div>
        {foraDaBase.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Ninguém pendente"
              description="Quando você trouxer a lista de um post, quem não estiver na base aparece aqui para virar prospect." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr>{["Pessoa", "O que fez", "Post", "Quando", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {foraDaBase.map((i) => (
                  <tr key={i.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{i.nome}</span>
                      <span className="block text-xs text-[color:var(--fg-3)]">
                        {[i.cargo, i.empresa].filter(Boolean).join(" · ") || "cargo não informado"}
                      </span>
                    </td>
                    <td className="td"><Badge tone="brand">{TIPO_ROTULO[i.tipo] ?? i.tipo}</Badge></td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{i.post}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(i.quando)}</td>
                    <td className="td text-right">
                      <Button variant="ghost" size="sm" loading={pendente}
                        onClick={() => rodar(() => virarProspect(i.id), `${i.nome} entrou na base.`)}>
                        Virar prospect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Na base ────────────────────────────────────────────────────────── */}
      {naBase.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
              Da base, interagiram com seus posts
            </p>
            <p className="ds-small mt-1">O sinal já entrou no score de cada um.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr>{["Pessoa", "O que fez", "Post", "Quando"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {naBase.map((i) => (
                  <tr key={i.id}>
                    <td className="td">
                      <a href={`/admin/prospeccao/${i.prospectId}`} className="font-medium text-[color:var(--brand)] underline">
                        {i.nome}
                      </a>
                      <span className="block text-xs text-[color:var(--fg-3)]">
                        {[i.cargo, i.empresa].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="td"><Badge tone="success">{TIPO_ROTULO[i.tipo] ?? i.tipo}</Badge></td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{i.post}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(i.quando)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
