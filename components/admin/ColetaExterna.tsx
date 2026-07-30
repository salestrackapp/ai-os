"use client";
/**
 * Coleta externa no LinkedIn.
 *
 * O bloco de aviso de risco que existia aqui foi removido a pedido do André (2026-07-30) — ele
 * conhece o risco, foi informado antes de decidir, e a tela é interna. O que NÃO saiu: o botão de
 * parada, sempre visível no topo, e a confirmação ao ligar a coleta. Numa ferramenta que pode
 * custar uma conta, a saída não se esconde atrás de um menu.
 *
 * O risco continua documentado onde precisa estar: docs/LIA_PROSPECCAO.md §6 (que é o que responde
 * a uma fiscalização) e o cabeçalho de lib/prospecting/coleta-linkedin.ts (que é o que a próxima
 * pessoa a mexer no código vai ler).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Badge, EmptyState, Kpi } from "@/components/ds";
import {
  salvarConfig, religar, pararTudo, salvarFonte, alternarFonte, removerFonte, rodarFonte,
} from "@/app/admin/prospeccao/coleta-externa/actions";

export type ConfigLinha = {
  ativo: boolean; actorAtividade: string | null; actorReacoes: string | null; actorPerfil: string | null;
  usaCookie: boolean; tetoDia: number; tetoPerfis: number;
  paradoAte: string | null; motivoParada: string | null;
};

export type FonteLinha = {
  id: string; nome: string; url: string; tipo: string; ativa: boolean;
  ultimaColeta: string | null; totalPessoas: number;
};

export type ExecucaoLinha = {
  escopo: string; alvo: string | null; status: string; itens: number;
  casados: number; novos: number; custoUsd: number | null; erro: string | null; quando: string;
};

const ESCOPO_ROTULO: Record<string, string> = {
  atividade_perfil: "atividade de um perfil",
  reacoes_post: "quem reagiu a um post",
  posts_proprios: "posts da pessoa",
  grupos: "grupos",
};

const quando = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

export function ColetaExterna({ config, fontes, execucoes, apifyOk, cookieOk }: {
  config: ConfigLinha; fontes: FonteLinha[]; execucoes: ExecucaoLinha[];
  apifyOk: boolean; cookieOk: boolean;
}) {
  const [f, setF] = useState({
    ativo: config.ativo,
    actorAtividade: config.actorAtividade ?? "",
    actorReacoes: config.actorReacoes ?? "",
    actorPerfil: config.actorPerfil ?? "",
    usaCookie: config.usaCookie,
    tetoDia: String(config.tetoDia),
    tetoPerfis: String(config.tetoPerfis),
  });
  const [novaFonte, setNovaFonte] = useState({ nome: "", url: "", tipo: "perfil" });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const parado = config.paradoAte && new Date(config.paradoAte) > new Date();
  const custoTotal = execucoes.reduce((s, e) => s + (e.custoUsd ?? 0), 0);

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
      {/*
        O bloco de aviso de risco foi removido da tela a pedido do André (2026-07-30): ele conhece
        o risco, foi informado antes da decisão, e esta é uma tela interna dele.
        O CONTROLE fica — o botão de parada continua no topo e sempre visível. Numa ferramenta que
        pode custar uma conta, a saída não se esconde atrás de um menu.
        O risco segue documentado em docs/LIA_PROSPECCAO.md §6 e no cabeçalho de
        lib/prospecting/coleta-linkedin.ts.
      */}
      <div className="flex justify-end">
        <Button variant="secondary" className="!border-[color:var(--danger)] !text-[color:var(--danger)]"
          loading={pendente} onClick={() => {
            if (!confirm("Parar toda a coleta externa por 7 dias?")) return;
            rodar(() => pararTudo(), "Coleta parada. Nada roda pelos próximos 7 dias.");
          }}>
          Parar tudo agora
        </Button>
      </div>

      {parado && (
        <Card>
          <p className="ds-body font-semibold">A coleta está pausada.</p>
          <p className="ds-small mt-1">
            {config.motivoParada} Volta a rodar em {quando(config.paradoAte)}.
          </p>
          <div className="mt-3">
            <Button variant="ghost" loading={pendente}
              onClick={() => rodar(() => religar(), "Coleta religada.")}>
              Religar agora
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi value={config.ativo && !parado ? "ligada" : "desligada"} label="Situação" />
        <Kpi value={String(fontes.filter((x) => x.ativa).length)} label="Fontes acompanhadas" />
        <Kpi value={`US$ ${custoTotal.toFixed(2)}`} label="Custo das últimas coletas" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/* ── Configuração ───────────────────────────────────────────────────── */}
      <Card title="Como a coleta funciona">
        {!apifyOk && (
          <p className="ds-small mb-4 text-[color:var(--danger)]">
            A chave do Apify não está configurada. Cadastre em Configurar → Parâmetros e
            integrações, com o provedor <b>apify</b>.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Actor: quem reagiu a um post"
            hint="O mais eficiente — um post rende dezenas de pessoas.">
            {(p) => <Input {...p} value={f.actorReacoes} onChange={(e) => setF({ ...f, actorReacoes: e.target.value })}
              placeholder="usuario/nome-do-actor" />}
          </Field>
          <Field label="Actor: atividade de um perfil"
            hint="Curtidas e comentários da pessoa em posts de terceiros.">
            {(p) => <Input {...p} value={f.actorAtividade} onChange={(e) => setF({ ...f, actorAtividade: e.target.value })}
              placeholder="usuario/nome-do-actor" />}
          </Field>
          <Field label="Actor: perfil completo" hint="Usado para grupos.">
            {(p) => <Input {...p} value={f.actorPerfil} onChange={(e) => setF({ ...f, actorPerfil: e.target.value })}
              placeholder="usuario/nome-do-actor" />}
          </Field>
          <Field label="Usar sua sessão do LinkedIn?"
            hint="Sem sessão, o actor vê só o que é público — e nenhuma conta corre risco.">
            {(p) => <Select {...p} value={f.usaCookie ? "sim" : "nao"}
              onChange={(e) => setF({ ...f, usaCookie: e.target.value === "sim" })}>
              <option value="nao">Não — só conteúdo público (mais seguro)</option>
              <option value="sim">Sim — usar minha sessão (vê mais, arrisca a conta)</option>
            </Select>}
          </Field>
          <Field label="Máximo de coletas por dia">
            {(p) => <Input {...p} type="number" min={0} max={50} value={f.tetoDia}
              onChange={(e) => setF({ ...f, tetoDia: e.target.value })} />}
          </Field>
          <Field label="Máximo de pessoas por coleta">
            {(p) => <Input {...p} type="number" min={1} max={200} value={f.tetoPerfis}
              onChange={(e) => setF({ ...f, tetoPerfis: e.target.value })} />}
          </Field>
        </div>

        {f.usaCookie && !cookieOk && (
          <p className="ds-small mt-4 text-[color:var(--warn)]">
            A sessão ainda não foi cadastrada. Salve o cookie <b>li_at</b> em Configurar →
            Parâmetros e integrações, com o provedor <b>linkedin_li_at</b>. Ele é a sua sessão
            inteira — quem o tiver entra na sua conta.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <Button variant="primary" loading={pendente}
            onClick={() => rodar(() => salvarConfig({ ...f, ativo: f.ativo }), "Configuração salva.")}>
            Salvar
          </Button>
          <Button variant={f.ativo ? "ghost" : "primary"} loading={pendente}
            onClick={() => {
              const novo = !f.ativo;
              if (novo && !confirm("Ligar a coleta externa? Ela contraria os termos do LinkedIn e pode custar a conta usada.")) return;
              setF({ ...f, ativo: novo });
              rodar(() => salvarConfig({ ...f, ativo: novo }), novo ? "Coleta ligada." : "Coleta desligada.");
            }}>
            {f.ativo ? "Desligar coleta" : "Ligar coleta"}
          </Button>
        </div>
      </Card>

      {/* ── Fontes ─────────────────────────────────────────────────────────── */}
      <Card title="Fontes acompanhadas">
        <p className="ds-small mb-4">
          Perfis e páginas que publicam sobre IA. O sistema lê <b>quem reagiu</b> a esses posts —
          uma requisição rende dezenas de pessoas, contra uma pessoa por requisição na varredura
          perfil a perfil. Mesmo resultado, uma fração da exposição.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome">
            {(p) => <Input {...p} value={novaFonte.nome} onChange={(e) => setNovaFonte({ ...novaFonte, nome: e.target.value })}
              placeholder="Ex.: perfil que publica sobre IA aplicada" />}
          </Field>
          <Field label="Link do LinkedIn">
            {(p) => <Input {...p} value={novaFonte.url} onChange={(e) => setNovaFonte({ ...novaFonte, url: e.target.value })}
              placeholder="https://www.linkedin.com/in/..." />}
          </Field>
          <Field label="Tipo">
            {(p) => <Select {...p} value={novaFonte.tipo} onChange={(e) => setNovaFonte({ ...novaFonte, tipo: e.target.value })}>
              <option value="perfil">Perfil</option>
              <option value="pagina">Página de empresa</option>
              <option value="hashtag">Hashtag</option>
              <option value="grupo">Grupo</option>
            </Select>}
          </Field>
        </div>
        <div className="mt-4">
          <Button variant="primary" loading={pendente}
            onClick={() => rodar(async () => {
              await salvarFonte(novaFonte);
              setNovaFonte({ nome: "", url: "", tipo: "perfil" });
            }, "Fonte adicionada.")}>
            Adicionar fonte
          </Button>
        </div>

        {fontes.length > 0 && (
          <div className="mt-6 overflow-x-auto border-t border-hairline pt-4">
            <table className="w-full min-w-[720px]">
              <thead><tr>{["Fonte", "Situação", "Pessoas", "Última coleta", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {fontes.map((x) => (
                  <tr key={x.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{x.nome}</span>
                      <span className="block text-xs text-[color:var(--fg-3)]">{x.tipo}</span>
                    </td>
                    <td className="td">
                      {x.ativa ? <Badge tone="success">ativa</Badge> : <Badge tone="neutral">pausada</Badge>}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-1)]">{x.totalPessoas}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{quando(x.ultimaColeta)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" loading={pendente}
                          onClick={() => rodar(() => rodarFonte(x.id))}>
                          Coletar agora
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => rodar(() => alternarFonte(x.id, !x.ativa))}>
                          {x.ativa ? "Pausar" : "Ativar"}
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => { if (confirm(`Remover "${x.nome}"?`)) rodar(() => removerFonte(x.id)); }}>
                          Remover
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Histórico ──────────────────────────────────────────────────────── */}
      {execucoes.length > 0 ? (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Últimas coletas</p>
            <p className="ds-small mt-1">Cada linha custou dinheiro e exposição. Vale conferir se rendeu.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr>{["Quando", "O quê", "Situação", "Lidos", "Na base", "Novos", "Custo"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {execucoes.map((e, i) => (
                  <tr key={i}>
                    <td className="td text-xs text-[color:var(--fg-2)]">{quando(e.quando)}</td>
                    <td className="td text-[color:var(--fg-2)]">{ESCOPO_ROTULO[e.escopo] ?? e.escopo}</td>
                    <td className="td">
                      {e.status === "concluida" ? <Badge tone="success">ok</Badge>
                        : e.status === "bloqueada" ? <Badge tone="danger">bloqueada</Badge>
                        : e.status === "falhou" ? <Badge tone="warn">falhou</Badge>
                        : <Badge tone="neutral">rodando</Badge>}
                      {e.erro && <span className="mt-1 block text-xs text-[color:var(--fg-3)]">{e.erro}</span>}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.itens}</td>
                    <td className="td font-jbmono text-[color:var(--fg-1)]">{e.casados}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.novos}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">
                      {e.custoUsd ? `US$ ${e.custoUsd.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState title="Nenhuma coleta ainda"
          description="Cadastre uma fonte que publica sobre IA e use “Coletar agora” para ler quem reagiu aos posts dela." />
      )}
    </div>
  );
}
