"use client";
/**
 * Administração — o que a Salestrack gasta, com quem, e o que disso ainda serve.
 *
 * A tela abre pelo custo RECORRENTE, não pela lista de fornecedores. Custo recorrente é o que
 * some da vista: entra uma vez, cobra todo mês, e só aparece na fatura do cartão junto de outros
 * dez. Foi assim que dois projetos Supabase ficaram sendo pagos, um deles vazio.
 *
 * Por isso a coluna "revisada em" existe e fica visível: "isto ainda serve?" é a pergunta que
 * ninguém faz sozinha, e a data force a resposta a aparecer.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { dataBR, diasAte } from "@/lib/formato/data";
import { salvarFornecedor, salvarDespesa, revisarDespesa, encerrarDespesa } from "@/app/admin/administracao/actions";

export type FornecedorLinha = { id: string; nome: string; categoria: string; site: string | null; ativo: boolean };

export type DespesaLinha = {
  id: string; descricao: string; fornecedor: string | null; categoria: string;
  recorrencia: string; valorCentavos: number; custoMensalCentavos: number;
  inicio: string; revisadaEm: string | null; observacao: string | null; ativa: boolean;
};

const CATEGORIA: Record<string, string> = {
  ferramenta: "ferramenta", infraestrutura: "infraestrutura", servico: "serviço",
  contabilidade: "contabilidade", juridico: "jurídico", marketing: "marketing",
  equipamento: "equipamento", imposto: "imposto", outro: "outro",
};
const RECORRENCIA: Record<string, string> = {
  mensal: "por mês", anual: "por ano", trimestral: "por trimestre", unica: "uma vez",
};

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Sem revisão há mais de 90 dias, a assinatura vira candidata a "ainda precisamos disto?". */
const DIAS_ATE_REVISAR = 90;
function precisaRevisar(revisadaEm: string | null): boolean {
  if (!revisadaEm) return true;
  return Math.abs(diasAte(revisadaEm) ?? 0) > DIAS_ATE_REVISAR;
}

export function Administracao({ fornecedores, despesas }: {
  fornecedores: FornecedorLinha[]; despesas: DespesaLinha[];
}) {
  const [novoF, setNovoF] = useState({ nome: "", categoria: "ferramenta", site: "" });
  const [novaD, setNovaD] = useState({
    vendorId: "", descricao: "", valor: "", categoria: "ferramenta",
    recorrencia: "mensal", inicio: new Date().toISOString().slice(0, 10), observacao: "",
  });
  const [abrindoF, setAbrindoF] = useState(false);
  const [abrindoD, setAbrindoD] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const ativas = despesas.filter((d) => d.ativa);
  const mensal = ativas.reduce((s, d) => s + d.custoMensalCentavos, 0);
  const aRevisar = ativas.filter((d) => precisaRevisar(d.revisadaEm));

  const porCategoria = new Map<string, number>();
  for (const d of ativas) {
    porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + d.custoMensalCentavos);
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  const rodar = (fn: () => Promise<unknown>, ok?: string) => {
    setErro(null); setAviso(null);
    iniciar(async () => {
      try { await fn(); if (ok) setAviso(ok); }
      catch (e) { setErro((e as Error).message); }
      finally { router.refresh(); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi value={reais(mensal)} label="Custo fixo por mês" />
        <Kpi value={reais(mensal * 12)} label="Equivalente no ano" />
        <Kpi value={String(aRevisar.length)} label="Sem revisar há 3 meses" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/* A revisão vem primeiro: é onde mora o dinheiro que se está gastando à toa. */}
      {aRevisar.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--warn)]">
              Vale conferir se ainda precisa
            </p>
            <p className="ds-small mt-1">
              Sem revisão há mais de 3 meses. Somam {reais(aRevisar.reduce((s, d) => s + d.custoMensalCentavos, 0))} por mês.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr>{["O quê", "Fornecedor", "Por mês", "Revisada em", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {aRevisar.map((d) => (
                  <tr key={d.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{d.descricao}</span>
                      {d.observacao && <span className="block text-xs text-[color:var(--fg-3)]">{d.observacao}</span>}
                    </td>
                    <td className="td text-[color:var(--fg-2)]">{d.fornecedor ?? "—"}</td>
                    <td className="td font-jbmono text-[color:var(--fg-1)]">{reais(d.custoMensalCentavos)}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">
                      {d.revisadaEm ? dataBR(d.revisadaEm) : "nunca"}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" loading={pendente}
                          onClick={() => rodar(() => revisarDespesa(d.id), "Marcada como revisada.")}>
                          Ainda preciso
                        </Button>
                        <Button variant="ghost" size="sm" loading={pendente}
                          onClick={() => {
                            if (!confirm(`Encerrar "${d.descricao}"? Ela sai do custo fixo.`)) return;
                            rodar(() => encerrarDespesa(d.id), "Despesa encerrada.");
                          }}>
                          Cancelar
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

      {categorias.length > 0 && (
        <Card title="Para onde vai o dinheiro">
          <div className="space-y-2">
            {categorias.map(([cat, valor]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-[color:var(--fg-2)]">{CATEGORIA[cat] ?? cat}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--gray-100)]">
                  <div className="h-full rounded-full bg-[color:var(--brand)]"
                    style={{ width: `${Math.round((valor / mensal) * 100)}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right font-jbmono text-sm text-[color:var(--fg-1)]">
                  {reais(valor)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {!abrindoD && <Button variant="primary" onClick={() => setAbrindoD(true)}>Nova despesa</Button>}
        {!abrindoF && <Button variant="ghost" onClick={() => setAbrindoF(true)}>Novo fornecedor</Button>}
      </div>

      {abrindoD && (
        <Card title="Nova despesa">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="O que é">
              {(p) => <Input {...p} value={novaD.descricao} onChange={(e) => setNovaD({ ...novaD, descricao: e.target.value })}
                placeholder="Ex.: Plano Pro da Vercel" />}
            </Field>
            <Field label="Fornecedor">
              {(p) => <Select {...p} value={novaD.vendorId} onChange={(e) => setNovaD({ ...novaD, vendorId: e.target.value })}>
                <option value="">— sem fornecedor —</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Select>}
            </Field>
            <Field label="Valor" hint="Em reais, do jeito que aparece na fatura.">
              {(p) => <Input {...p} value={novaD.valor} onChange={(e) => setNovaD({ ...novaD, valor: e.target.value })}
                placeholder="25,00" />}
            </Field>
            <Field label="Com que frequência">
              {(p) => <Select {...p} value={novaD.recorrencia} onChange={(e) => setNovaD({ ...novaD, recorrencia: e.target.value })}>
                {Object.entries(RECORRENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Categoria">
              {(p) => <Select {...p} value={novaD.categoria} onChange={(e) => setNovaD({ ...novaD, categoria: e.target.value })}>
                {Object.entries(CATEGORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Desde">
              {(p) => <Input {...p} type="date" value={novaD.inicio} onChange={(e) => setNovaD({ ...novaD, inicio: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Observação">
              {(p) => <Textarea {...p} rows={2} value={novaD.observacao}
                onChange={(e) => setNovaD({ ...novaD, observacao: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await salvarDespesa(novaD);
                setAbrindoD(false);
                setNovaD({ ...novaD, descricao: "", valor: "", observacao: "" });
              }, "Despesa registrada.")}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindoD(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      )}

      {abrindoF && (
        <Card title="Novo fornecedor">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nome">
              {(p) => <Input {...p} value={novoF.nome} onChange={(e) => setNovoF({ ...novoF, nome: e.target.value })} />}
            </Field>
            <Field label="Categoria">
              {(p) => <Select {...p} value={novoF.categoria} onChange={(e) => setNovoF({ ...novoF, categoria: e.target.value })}>
                {Object.entries(CATEGORIA).filter(([k]) => k !== "imposto").map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Site">
              {(p) => <Input {...p} value={novoF.site} onChange={(e) => setNovoF({ ...novoF, site: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await salvarFornecedor(novoF);
                setAbrindoF(false); setNovoF({ nome: "", categoria: "ferramenta", site: "" });
              }, "Fornecedor cadastrado.")}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindoF(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      )}

      {despesas.length === 0 ? (
        <EmptyState title="Nenhuma despesa registrada"
          description="Cadastre as assinaturas e serviços que a Salestrack paga. É o que permite ver, num lugar só, quanto sai por mês — e o que disso já não serve." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead><tr>{["O quê", "Fornecedor", "Valor", "Frequência", "Por mês", "Revisada"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {despesas.map((d) => (
                  <tr key={d.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{d.descricao}</span>
                      <span className="block text-xs text-[color:var(--fg-3)]">{CATEGORIA[d.categoria] ?? d.categoria}</span>
                      {!d.ativa && <Badge tone="neutral">encerrada</Badge>}
                    </td>
                    <td className="td text-[color:var(--fg-2)]">{d.fornecedor ?? "—"}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{reais(d.valorCentavos)}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{RECORRENCIA[d.recorrencia] ?? d.recorrencia}</td>
                    <td className="td font-jbmono text-[color:var(--fg-1)]">
                      {d.custoMensalCentavos > 0 ? reais(d.custoMensalCentavos) : "—"}
                    </td>
                    <td className="td text-xs text-[color:var(--fg-2)]">
                      {d.revisadaEm ? dataBR(d.revisadaEm) : <span className="text-[color:var(--warn)]">nunca</span>}
                    </td>
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
