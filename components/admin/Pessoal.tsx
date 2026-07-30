"use client";
/**
 * RH — pessoas e ausências.
 *
 * Duas regras que valem só nesta tela:
 *
 *  1. **Salário não aparece em lista.** Só sob clique, uma pessoa por vez, e a leitura é
 *     registrada. Coluna de salário numa tabela é como a informação vaza por cima do ombro de
 *     alguém numa reunião.
 *  2. **CPF não é exibido.** Ele existe cifrado, serve para identificar, e não precisa estar na
 *     tela para o RH trabalhar.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { dataBR } from "@/lib/formato/data";
import {
  cadastrarPessoa, desligarPessoa, registrarAusencia, verRemuneracao, registrarRemuneracao,
} from "@/app/admin/rh/actions";

export type PessoaLinha = {
  id: string; nome: string; email: string | null; cargo: string | null;
  departamento: string | null; regime: string; admissao: string;
  desligamento: string | null; ausenciasNoAno: number;
};

export type AusenciaLinha = {
  id: string; pessoa: string; tipo: string; inicio: string; fim: string; dias: number; status: string;
};

const REGIME: Record<string, string> = {
  clt: "CLT", pj: "PJ", estagio: "estágio", aprendiz: "aprendiz", socio: "sócio",
};
const TIPO_AUSENCIA: Record<string, string> = {
  ferias: "férias", licenca: "licença", falta: "falta",
  afastamento: "afastamento", folga: "folga", home_office: "home office",
};

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Pessoal({ pessoas, ausencias, papel }: {
  pessoas: PessoaLinha[]; ausencias: AusenciaLinha[]; papel: string;
}) {
  const [nova, setNova] = useState({
    nome: "", email: "", cpf: "", cargo: "", departamento: "", regime: "clt", admissao: "",
  });
  const [abrindo, setAbrindo] = useState(false);
  const [ausencia, setAusencia] = useState<{ employeeId: string; tipo: string; inicio: string; fim: string; observacao: string } | null>(null);
  const [salario, setSalario] = useState<{ id: string; nome: string; linhas: { valor: number; tipo: string; desde: string }[] | null } | null>(null);
  const [novoSalario, setNovoSalario] = useState<{ id: string; valor: string; tipo: string; desde: string; motivo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const ehAdmin = papel === "rh_admin";
  const ativos = pessoas.filter((p) => !p.desligamento);

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
        <Kpi value={String(ativos.length)} label="Pessoas ativas" />
        <Kpi value={String(ausencias.filter((a) => a.status === "aprovada").length)} label="Ausências registradas" />
        <Kpi value={REGIME[papel] ?? papel.replace("rh_", "")} label="Seu acesso" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {ehAdmin && (abrindo ? (
        <Card title="Cadastrar pessoa">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              {(p) => <Input {...p} value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />}
            </Field>
            <Field label="E-mail corporativo" hint="É o que liga a pessoa ao acesso dela no sistema.">
              {(p) => <Input {...p} type="email" value={nova.email} onChange={(e) => setNova({ ...nova, email: e.target.value })} />}
            </Field>
            <Field label="CPF" hint="Guardado cifrado. Não volta a aparecer na tela.">
              {(p) => <Input {...p} value={nova.cpf} onChange={(e) => setNova({ ...nova, cpf: e.target.value })}
                placeholder="000.000.000-00" />}
            </Field>
            <Field label="Cargo">
              {(p) => <Input {...p} value={nova.cargo} onChange={(e) => setNova({ ...nova, cargo: e.target.value })} />}
            </Field>
            <Field label="Área">
              {(p) => <Input {...p} value={nova.departamento} onChange={(e) => setNova({ ...nova, departamento: e.target.value })} />}
            </Field>
            <Field label="Regime">
              {(p) => <Select {...p} value={nova.regime} onChange={(e) => setNova({ ...nova, regime: e.target.value })}>
                {Object.entries(REGIME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Admissão">
              {(p) => <Input {...p} type="date" value={nova.admissao} onChange={(e) => setNova({ ...nova, admissao: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await cadastrarPessoa(nova);
                setAbrindo(false);
                setNova({ nome: "", email: "", cpf: "", cargo: "", departamento: "", regime: "clt", admissao: "" });
              }, "Pessoa cadastrada.")}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindo(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setAbrindo(true)}>Cadastrar pessoa</Button>
      ))}

      {pessoas.length === 0 ? (
        <EmptyState title="Nenhuma pessoa cadastrada"
          description="Cadastre o time para acompanhar admissões, ausências e histórico." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr>{["Pessoa", "Cargo", "Regime", "Desde", "Ausências no ano", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr key={p.id}>
                    <td className="td">
                      <span className="block font-medium text-[color:var(--fg-1)]">{p.nome}</span>
                      {p.email && <span className="block text-xs text-[color:var(--fg-3)]">{p.email}</span>}
                      {p.desligamento && (
                        <Badge tone="neutral">desligado em {dataBR(p.desligamento)}</Badge>
                      )}
                    </td>
                    <td className="td text-[color:var(--fg-2)]">
                      {p.cargo ?? "—"}
                      {p.departamento && <span className="block text-xs text-[color:var(--fg-3)]">{p.departamento}</span>}
                    </td>
                    <td className="td"><Badge tone="brand">{REGIME[p.regime] ?? p.regime}</Badge></td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{dataBR(p.admissao)}</td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{p.ausenciasNoAno} dia(s)</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm"
                          onClick={() => setAusencia({ employeeId: p.id, tipo: "ferias", inicio: "", fim: "", observacao: "" })}>
                          Ausência
                        </Button>
                        {ehAdmin && (
                          <Button variant="ghost" size="sm" loading={pendente}
                            onClick={() => rodar(async () => {
                              const linhas = await verRemuneracao(p.id);
                              setSalario({ id: p.id, nome: p.nome, linhas });
                            })}>
                            Remuneração
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Ausência ─────────────────────────────────────────────────────────── */}
      {ausencia && (
        <Card title="Registrar ausência">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Tipo">
              {(p) => <Select {...p} value={ausencia.tipo} onChange={(e) => setAusencia({ ...ausencia, tipo: e.target.value })}>
                {Object.entries(TIPO_AUSENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Início">
              {(p) => <Input {...p} type="date" value={ausencia.inicio} onChange={(e) => setAusencia({ ...ausencia, inicio: e.target.value })} />}
            </Field>
            <Field label="Fim">
              {(p) => <Input {...p} type="date" value={ausencia.fim} onChange={(e) => setAusencia({ ...ausencia, fim: e.target.value })} />}
            </Field>
            <Field label="Observação">
              {(p) => <Input {...p} value={ausencia.observacao} onChange={(e) => setAusencia({ ...ausencia, observacao: e.target.value })} />}
            </Field>
          </div>
          {ausencia.tipo === "afastamento" && (
            <p className="ds-small mt-3 text-[color:var(--warn)]">
              Atestado e diagnóstico <b>não</b> se registram aqui — dado de saúde fica em local
              separado, com acesso restrito e leitura auditada. Registre só o período.
            </p>
          )}
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await registrarAusencia(ausencia);
                setAusencia(null);
              }, "Ausência registrada.")}>
              Registrar
            </Button>
            <Button variant="ghost" onClick={() => setAusencia(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Remuneração — sob clique, uma pessoa por vez, leitura auditada ────── */}
      {salario && (
        <Card title={`Remuneração — ${salario.nome}`}>
          <p className="ds-small mb-4">
            Esta consulta ficou registrada na auditoria do RH, com seu nome e a data.
          </p>
          {(salario.linhas ?? []).length === 0 ? (
            <p className="ds-body">Nenhuma remuneração registrada.</p>
          ) : (
            <table className="w-full">
              <thead><tr>{["Valor", "Tipo", "Desde"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {(salario.linhas ?? []).map((l, i) => (
                  <tr key={i}>
                    <td className="td font-jbmono font-semibold text-[color:var(--fg-1)]">{reais(l.valor)}</td>
                    <td className="td text-[color:var(--fg-2)]">{l.tipo}</td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{dataBR(l.desde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 flex flex-wrap gap-3 border-t border-hairline pt-4">
            <Button variant="ghost"
              onClick={() => setNovoSalario({ id: salario.id, valor: "", tipo: "salario", desde: "", motivo: "" })}>
              Registrar novo valor
            </Button>
            <Button variant="ghost" onClick={() => { setSalario(null); setNovoSalario(null); }}>Fechar</Button>
          </div>

          {novoSalario && (
            <div className="mt-4 rounded-[10px] border border-hairline bg-[var(--bg-2)] p-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Valor">
                  {(p) => <Input {...p} value={novoSalario.valor} placeholder="7.500,00"
                    onChange={(e) => setNovoSalario({ ...novoSalario, valor: e.target.value })} />}
                </Field>
                <Field label="Tipo">
                  {(p) => <Select {...p} value={novoSalario.tipo}
                    onChange={(e) => setNovoSalario({ ...novoSalario, tipo: e.target.value })}>
                    {["salario", "bonus", "comissao", "ajuda_custo", "pro_labore"].map((t) =>
                      <option key={t} value={t}>{t}</option>)}
                  </Select>}
                </Field>
                <Field label="A partir de">
                  {(p) => <Input {...p} type="date" value={novoSalario.desde}
                    onChange={(e) => setNovoSalario({ ...novoSalario, desde: e.target.value })} />}
                </Field>
                <Field label="Motivo" hint="Mérito, promoção, reajuste…">
                  {(p) => <Input {...p} value={novoSalario.motivo}
                    onChange={(e) => setNovoSalario({ ...novoSalario, motivo: e.target.value })} />}
                </Field>
              </div>
              <div className="mt-4">
                <Button variant="primary" loading={pendente}
                  onClick={() => rodar(async () => {
                    await registrarRemuneracao({ employeeId: novoSalario.id, ...novoSalario });
                    setNovoSalario(null); setSalario(null);
                  }, "Remuneração registrada. A vigência anterior foi encerrada.")}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {ausencias.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Ausências</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr>{["Pessoa", "Tipo", "Período", "Dias"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {ausencias.map((a) => (
                  <tr key={a.id}>
                    <td className="td text-[color:var(--fg-1)]">{a.pessoa}</td>
                    <td className="td"><Badge tone="neutral">{TIPO_AUSENCIA[a.tipo] ?? a.tipo}</Badge></td>
                    <td className="td text-xs text-[color:var(--fg-2)]">
                      {dataBR(a.inicio)} → {dataBR(a.fim)}
                    </td>
                    <td className="td font-jbmono text-[color:var(--fg-2)]">{a.dias}</td>
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
