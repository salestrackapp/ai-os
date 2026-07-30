"use client";
/**
 * Buscas automáticas de prospecção.
 *
 * Duas coisas que a tela precisa deixar claras sem que ninguém pergunte:
 *
 *  1. **Isto gasta dinheiro.** Cada enriquecimento consome crédito do Apollo. O teto aparece ao
 *     lado do campo, não escondido num tooltip, e o resultado da execução diz quantos foram
 *     gastos.
 *  2. **Recorte não é opcional.** Uma busca sem cargo nem local traz gente que nunca teve o
 *     problema que resolvemos — e é a distinção entre prospecção direcionada e varredura que
 *     sustenta a base legal. A ação recusa; aqui a tela explica antes.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { salvarBusca, alternarBusca, arquivarBusca, rodarAgora } from "@/app/admin/prospeccao/buscas/actions";

export type BuscaLinha = {
  id: string; nome: string; icp: string | null; ativa: boolean;
  cargos: string[]; locais: string[]; setores: string[]; porte: string[];
  metaPorExecucao: number; tetoEnriquecimento: number;
  ultimaExecucao: string | null; totalColetado: number; ultimoErro: string | null;
};

export type ExecucaoLinha = {
  busca: string; quando: string; vistos: number; criados: number;
  duplicados: number; recusados: number; enriquecidos: number; erro: string | null;
};

const VAZIO = {
  nome: "", icp: "icp1", cargos: "", senioridades: "", setores: "", locais: "Brazil",
  porte: "", palavrasChave: "", meta: "25", teto: "25", ativa: true,
};

const PORTES = ["1,10", "11,50", "51,200", "201,500", "501,1000", "1001,5000", "5001,10000", "10001,1000000"];
const PORTE_LEGIVEL: Record<string, string> = {
  "1,10": "até 10", "11,50": "11 a 50", "51,200": "51 a 200", "201,500": "201 a 500",
  "501,1000": "501 a 1.000", "1001,5000": "1.001 a 5.000", "5001,10000": "5.001 a 10.000",
  "10001,1000000": "mais de 10.000",
};

const data = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export function BuscasProspeccao({ buscas, execucoes, apolloOk }: {
  buscas: BuscaLinha[]; execucoes: ExecucaoLinha[]; apolloOk: boolean;
}) {
  const [f, setF] = useState(VAZIO);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const ativas = buscas.filter((b) => b.ativa).length;
  const coletado = buscas.reduce((s, b) => s + b.totalColetado, 0);
  const creditoDiario = buscas.filter((b) => b.ativa).reduce((s, b) => s + b.tetoEnriquecimento, 0);

  /**
   * `revalidatePath` na Server Action invalida o cache do servidor, mas não força ESTA árvore a
   * re-renderizar — os números do topo continuavam mostrando o estado anterior enquanto a mensagem
   * dizia que tinha dado certo. Quem opera lê os dois e conclui que falhou. `router.refresh()`
   * puxa o RSC atualizado; sem ele, a confirmação e a tela se contradizem.
   */
  const rodar = (fn: () => Promise<unknown>, ok?: string) => {
    setErro(null); setAviso(null);
    iniciar(async () => {
      try { const r = await fn(); if (ok) setAviso(typeof r === "string" ? r : ok); }
      catch (e) { setErro((e as Error).message); }
      finally { router.refresh(); }
    });
  };

  const alternarPorte = (p: string) => {
    const atual = f.porte ? f.porte.split(",,").filter(Boolean) : [];
    const novo = atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p];
    setF({ ...f, porte: novo.join(",,") });
  };
  const portesEscolhidos = f.porte ? f.porte.split(",,").filter(Boolean) : [];

  return (
    <div className="space-y-6">
      {!apolloOk && (
        <Card>
          <p className="ds-body">
            <b>A chave do Apollo não está configurada.</b> As buscas ficam salvas, mas nada é
            coletado até a chave entrar em Configurar → Parâmetros e integrações.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi value={String(ativas)} label="Buscas ativas" />
        <Kpi value={String(coletado)} label="Pessoas já coletadas" />
        <Kpi value={`até ${creditoDiario}`} label="Créditos Apollo por dia" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {abrindo ? (
        <Card title="Nova busca">
          <p className="ds-small mb-4">
            A busca roda sozinha todo dia às 5h e traz gente nova a cada execução — ela lembra em
            que ponto parou. Informe ao menos os cargos ou os locais: uma busca sem recorte traz
            quem nunca teve o problema que a Salestrack resolve.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da busca" hint="Como você vai reconhecê-la depois.">
              {(p) => <Input {...p} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })}
                placeholder="Ex.: Diretores de operação em indústrias no Sul" />}
            </Field>
            <Field label="Perfil (ICP)">
              {(p) => <Select {...p} value={f.icp} onChange={(e) => setF({ ...f, icp: e.target.value })}>
                <option value="icp1">ICP 1 · CEOs e fundadores (médias)</option>
                <option value="icp2">ICP 2 · Vendas e marketing (PME)</option>
                <option value="icp3">ICP 3 · Operações e finanças (grandes)</option>
              </Select>}
            </Field>
            <Field label="Cargos" hint="Um por linha, ou separados por vírgula.">
              {(p) => <Textarea {...p} rows={3} value={f.cargos} onChange={(e) => setF({ ...f, cargos: e.target.value })}
                placeholder={"Diretor de Operações\nCOO\nHead of Operations"} />}
            </Field>
            <Field label="Locais" hint="Onde a PESSOA trabalha. Em inglês, como o Apollo espera.">
              {(p) => <Textarea {...p} rows={3} value={f.locais} onChange={(e) => setF({ ...f, locais: e.target.value })}
                placeholder={"Brazil\nSao Paulo, Brazil"} />}
            </Field>
            <Field label="Setores" hint="Palavras que descrevem a empresa. Opcional.">
              {(p) => <Input {...p} value={f.setores} onChange={(e) => setF({ ...f, setores: e.target.value })}
                placeholder="manufacturing, logistics" />}
            </Field>
            <Field label="Senioridade" hint="Opcional: owner, c_suite, vp, director, manager.">
              {(p) => <Input {...p} value={f.senioridades} onChange={(e) => setF({ ...f, senioridades: e.target.value })}
                placeholder="c_suite, director" />}
            </Field>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
              Porte da empresa
            </p>
            <div className="flex flex-wrap gap-2">
              {PORTES.map((p) => (
                <button key={p} type="button" onClick={() => alternarPorte(p)}
                  className={`rounded-ds-pill border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    portesEscolhidos.includes(p)
                      ? "border-[color:var(--brand)] bg-[color:var(--tile)] text-[color:var(--brand-deep)]"
                      : "border-hairline text-[color:var(--fg-2)]"}`}>
                  {PORTE_LEGIVEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Palavras-chave" hint="Busca livre no perfil. Opcional.">
              {(p) => <Input {...p} value={f.palavrasChave} onChange={(e) => setF({ ...f, palavrasChave: e.target.value })} />}
            </Field>
            <Field label="Pessoas por execução" hint="Quantas trazer por dia.">
              {(p) => <Input {...p} type="number" min={1} max={200} value={f.meta}
                onChange={(e) => setF({ ...f, meta: e.target.value })} />}
            </Field>
            <Field label="Teto de créditos por dia"
              hint="Cada e-mail descoberto consome 1 crédito pago do Apollo. Este é o limite.">
              {(p) => <Input {...p} type="number" min={0} max={200} value={f.teto}
                onChange={(e) => setF({ ...f, teto: e.target.value })} />}
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => { await salvarBusca(f); setAbrindo(false); setF(VAZIO); },
                "Busca criada. Roda amanhã às 5h, ou use “Rodar agora”.")}>
              Salvar busca
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindo(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setAbrindo(true)}>Nova busca</Button>
      )}

      {buscas.length === 0 ? (
        <EmptyState title="Nenhuma busca configurada"
          description="Crie uma busca para que o sistema traga sozinho, todo dia, pessoas com o perfil que você definir — sempre com dado profissional corporativo." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead><tr>
                {["Busca", "Situação", "Recorte", "Coletados", "Última execução", ""].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {buscas.map((b) => (
                  <tr key={b.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{b.nome}</span>
                      <span className="block text-xs text-[color:var(--fg-3)]">
                        {b.metaPorExecucao}/dia · até {b.tetoEnriquecimento} créditos
                      </span>
                    </td>
                    <td className="td">
                      {b.ultimoErro
                        ? <Badge tone="danger">com erro</Badge>
                        : b.ativa ? <Badge tone="success">ativa</Badge> : <Badge tone="neutral">pausada</Badge>}
                      {b.ultimoErro && <span className="mt-1 block text-xs text-[color:var(--fg-3)]">{b.ultimoErro}</span>}
                    </td>
                    <td className="td text-[color:var(--fg-2)]">
                      <span className="block text-xs">{b.cargos.slice(0, 3).join(", ") || "qualquer cargo"}</span>
                      <span className="block text-xs text-[color:var(--fg-3)]">{b.locais.join(", ") || "qualquer lugar"}</span>
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-1)]">{b.totalColetado}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(b.ultimaExecucao)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" loading={pendente}
                          onClick={() => rodar(async () => {
                            const r = await rodarAgora(b.id);
                            return r.erro
                              ? `Não rodou: ${r.erro}`
                              : `${r.criados} pessoa(s) nova(s), ${r.duplicados} já conhecida(s), ${r.enriquecidos} crédito(s) usado(s).`;
                          }, "Busca executada.")}>
                          Rodar agora
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => rodar(() => alternarBusca(b.id, !b.ativa))}>
                          {b.ativa ? "Pausar" : "Ativar"}
                        </Button>
                        <Button variant="ghost" size="sm"
                          onClick={() => {
                            if (!confirm(`Arquivar "${b.nome}"? As pessoas já coletadas continuam na base.`)) return;
                            rodar(() => arquivarBusca(b.id));
                          }}>
                          Arquivar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {execucoes.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Últimas execuções</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>
                {["Busca", "Quando", "Vistos", "Novos", "Já conhecidos", "Recusados", "Créditos"].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {execucoes.map((e, i) => (
                  <tr key={i}>
                    <td className="td text-[color:var(--fg-1)]">{e.busca}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(e.quando)}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.vistos}</td>
                    <td className="td font-jbmono font-semibold text-[color:var(--fg-1)]">{e.criados}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.duplicados}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">
                      {e.recusados}
                      {e.recusados > 0 && <span className="ml-1 text-xs text-[color:var(--fg-3)]">caixa pessoal</span>}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{e.enriquecidos}</td>
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
