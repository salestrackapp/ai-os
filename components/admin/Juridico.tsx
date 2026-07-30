"use client";
/**
 * Jurídico — biblioteca de cláusulas e demandas.
 *
 * A tela abre pelas DEMANDAS com prazo, não pela biblioteca. Cláusula é consulta; demanda com
 * prazo é o que vence. Um painel jurídico que abre pelo acervo esconde justamente a parte que
 * tem data.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { dataBR, diasAte } from "@/lib/formato/data";
import { salvarClausula, criarDemanda, mudarStatusDemanda } from "@/app/admin/juridico/actions";

export type ClausulaLinha = {
  id: string; codigo: string; titulo: string; categoria: string; texto: string;
  variaveis: string[]; vigente: boolean; versao: number; observacao: string | null;
};

export type DemandaLinha = {
  id: string; tipo: string; titulo: string; descricao: string | null; status: string;
  prioridade: string; prazo: string | null; cliente: string | null; concluidaEm: string | null;
};

export type OrgOpcao = { id: string; nome: string };

const TIPO: Record<string, string> = {
  notificacao: "notificação", cobranca: "cobrança", disputa: "disputa",
  adequacao: "adequação", consulta: "consulta", aditivo: "termo aditivo", rescisao: "rescisão",
};
const STATUS: Record<string, string> = {
  aberta: "aberta", em_andamento: "em andamento", aguardando_terceiro: "aguardando terceiro",
  concluida: "concluída", arquivada: "arquivada",
};
const PRIORIDADE_TOM: Record<string, "neutral" | "brand" | "warn" | "danger"> = {
  baixa: "neutral", media: "brand", alta: "warn", critica: "danger",
};
const CATEGORIA: Record<string, string> = {
  objeto: "Objeto", prazo: "Prazo", comercial: "Comercial", manutencao: "Manutenção",
  obrigacoes: "Obrigações", propriedade: "Propriedade intelectual",
  confidencialidade: "Confidencialidade", lgpd: "LGPD", vigencia: "Vigência",
  geral: "Disposições gerais", foro: "Foro",
};

export function Juridico({ clausulas, demandas, orgs }: {
  clausulas: ClausulaLinha[]; demandas: DemandaLinha[]; orgs: OrgOpcao[];
}) {
  const [editando, setEditando] = useState<{ id: string; titulo: string; texto: string; motivo: string; vigente: boolean } | null>(null);
  const [vendo, setVendo] = useState<string | null>(null);
  const [nova, setNova] = useState({ tipo: "notificacao", titulo: "", descricao: "", prazo: "", prioridade: "media", orgId: "" });
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const abertas = demandas.filter((d) => !d.concluidaEm);
  const vencidas = abertas.filter((d) => d.prazo && (diasAte(d.prazo) ?? 0) < 0);

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
        <Kpi value={String(abertas.length)} label="Demandas abertas" />
        <Kpi value={String(vencidas.length)} label="Fora do prazo" />
        <Kpi value={String(clausulas.filter((c) => c.vigente).length)} label="Cláusulas vigentes" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/* ── Demandas ───────────────────────────────────────────────────────── */}
      {abrindo ? (
        <Card title="Nova demanda">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              {(p) => <Select {...p} value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>
                {Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Cliente" hint="Opcional — nem toda demanda é de um cliente.">
              {(p) => <Select {...p} value={nova.orgId} onChange={(e) => setNova({ ...nova, orgId: e.target.value })}>
                <option value="">— sem cliente específico —</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Select>}
            </Field>
            <Field label="Título">
              {(p) => <Input {...p} value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })}
                placeholder="Ex.: Notificar IMAGO sobre parcelas em aberto" />}
            </Field>
            <Field label="Prazo">
              {(p) => <Input {...p} type="date" value={nova.prazo} onChange={(e) => setNova({ ...nova, prazo: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Descrição">
              {(p) => <Textarea {...p} rows={3} value={nova.descricao}
                onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />}
            </Field>
            <Field label="Prioridade">
              {(p) => <Select {...p} value={nova.prioridade} onChange={(e) => setNova({ ...nova, prioridade: e.target.value })}>
                {["baixa", "media", "alta", "critica"].map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await criarDemanda(nova);
                setAbrindo(false);
                setNova({ ...nova, titulo: "", descricao: "", prazo: "" });
              }, "Demanda registrada.")}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindo(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setAbrindo(true)}>Nova demanda</Button>
      )}

      {abertas.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">Demandas abertas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr>{["O quê", "Tipo", "Cliente", "Prazo", "Situação", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {abertas.map((d) => {
                  const dias = d.prazo ? diasAte(d.prazo) : null;
                  return (
                    <tr key={d.id}>
                      <td className="td">
                        <span className="block font-medium text-[color:var(--fg-1)]">{d.titulo}</span>
                        {d.descricao && <span className="block text-xs text-[color:var(--fg-3)]">{d.descricao}</span>}
                      </td>
                      <td className="td"><Badge tone={PRIORIDADE_TOM[d.prioridade] ?? "neutral"}>{TIPO[d.tipo] ?? d.tipo}</Badge></td>
                      <td className="td text-xs text-[color:var(--fg-2)]">{d.cliente ?? "—"}</td>
                      <td className="td text-xs">
                        {dataBR(d.prazo)}
                        {dias !== null && dias < 0 && (
                          <span className="block text-[color:var(--danger)]">{Math.abs(dias)} dia(s) em atraso</span>
                        )}
                      </td>
                      <td className="td text-xs text-[color:var(--fg-2)]">{STATUS[d.status] ?? d.status}</td>
                      <td className="td text-right">
                        <Select value={d.status} aria-label={`Situação de ${d.titulo}`}
                          className="!w-auto !py-1 !text-xs"
                          onChange={(e) => rodar(() => mudarStatusDemanda(d.id, e.target.value))}>
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Biblioteca ─────────────────────────────────────────────────────── */}
      <Card className="p-0">
        <div className="border-b border-hairline px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">
            Biblioteca de cláusulas
          </p>
          <p className="ds-small mt-1">
            Base do contrato Salestrack/IMAGO de 07/07/2026. Editar aqui muda as minutas <b>futuras</b> —
            contratos já assinados carregam a própria cópia do texto e não mudam.
          </p>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {clausulas.map((c) => (
            <div key={c.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[color:var(--fg-1)]">{c.titulo}</span>
                <Badge tone="neutral">{CATEGORIA[c.categoria] ?? c.categoria}</Badge>
                {!c.vigente && <Badge tone="warn">fora de uso</Badge>}
                {c.versao > 1 && <span className="text-xs text-[color:var(--fg-3)]">versão {c.versao}</span>}
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="sm"
                    onClick={() => setVendo(vendo === c.id ? null : c.id)}>
                    {vendo === c.id ? "Fechar" : "Ver texto"}
                  </Button>
                  <Button variant="ghost" size="sm"
                    onClick={() => setEditando({ id: c.id, titulo: c.titulo, texto: c.texto, motivo: "", vigente: c.vigente })}>
                    Editar
                  </Button>
                </div>
              </div>
              {c.variaveis.length > 0 && (
                <p className="mt-1 text-xs text-[color:var(--fg-3)]">
                  preenche: {c.variaveis.join(", ")}
                </p>
              )}

              {vendo === c.id && (
                <pre className="mt-3 whitespace-pre-wrap rounded-[8px] bg-[var(--bg-2)] p-4 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">
                  {c.texto}
                </pre>
              )}

              {editando?.id === c.id && (
                <div className="mt-3 rounded-[10px] border border-hairline bg-[var(--bg-2)] p-4">
                  <Field label="Título">
                    {(p) => <Input {...p} value={editando.titulo}
                      onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} />}
                  </Field>
                  <div className="mt-3">
                    <Field label="Texto" hint="Use {{variavel}} para o que muda de contrato para contrato.">
                      {(p) => <Textarea {...p} rows={12} value={editando.texto}
                        onChange={(e) => setEditando({ ...editando, texto: e.target.value })} />}
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Por que está mudando?"
                      hint="Fica no histórico. Sem isso, daqui a um ano ninguém sabe se mudou por decisão comercial ou por erro.">
                      {(p) => <Input {...p} value={editando.motivo}
                        onChange={(e) => setEditando({ ...editando, motivo: e.target.value })} />}
                    </Field>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="primary" loading={pendente}
                      onClick={() => rodar(async () => {
                        await salvarClausula(editando);
                        setEditando(null);
                      }, "Cláusula atualizada. A versão anterior ficou no histórico.")}>
                      Salvar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                    <label className="flex items-center gap-2 text-sm text-[color:var(--fg-2)]">
                      <input type="checkbox" checked={editando.vigente}
                        onChange={(e) => setEditando({ ...editando, vigente: e.target.checked })} />
                      usar nas minutas novas
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
          {clausulas.length === 0 && (
            <div className="p-6">
              <EmptyState title="Biblioteca vazia" description="Nenhuma cláusula cadastrada." />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
