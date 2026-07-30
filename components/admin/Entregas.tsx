"use client";
/**
 * O que foi vendido versus o que foi entregue.
 *
 * A tela abre pelo que está ATRASADO, não pela lista completa. Um painel de entregas que começa
 * mostrando tudo obriga quem chega a procurar o problema; começando pelo atraso, o problema se
 * apresenta sozinho. Se não há atraso, o bloco some — ausência de alerta é informação, e um
 * "nenhum atraso 🎉" permanente vira ruído que ninguém lê.
 */
import { useState, useTransition } from "react";
import { dataBR } from "@/lib/formato/data";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import {
  criarEntrega, mudarStatus, removerEntrega, pararProjetoDoCliente, retomarProjetoDoCliente,
} from "@/app/admin/entregas/actions";

export type EntregaLinha = {
  id: string; orgId: string; projectId: string; cliente: string; titulo: string; frente: string | null;
  status: string; prazo: string | null; entregueEm: string | null;
  diasDeAtraso: number | null; observacao: string | null; ultimoMotivo: string | null;
  standby: { desde: string; motivo: string; dias: number } | null;
  historico: { de: string | null; para: string; motivo: string | null; quando: string }[];
};

export type StandbyLinha = {
  projectId: string; cliente: string; desde: string; motivo: string; dias: number;
};

const MOTIVO_ROTULO: Record<string, string> = {
  inadimplencia: "pagamento em atraso",
  aguardando_cliente: "aguardando o cliente",
  escopo_em_revisao: "escopo em revisão",
  pausa_solicitada: "pausa pedida pelo cliente",
  outro: "outro motivo",
};

export type OrgOpcao = { id: string; nome: string };

const STATUS_ROTULO: Record<string, string> = {
  planejado: "a fazer", em_andamento: "fazendo", entregue: "entregue", bloqueado: "travado",
};
const STATUS_TOM: Record<string, "neutral" | "brand" | "success" | "danger"> = {
  planejado: "neutral", em_andamento: "brand", entregue: "success", bloqueado: "danger",
};

const data = dataBR;   // trata coluna `date` sem deixar o fuso puxar o dia para trás

export function Entregas({ linhas, orgs, standby }: {
  linhas: EntregaLinha[]; orgs: OrgOpcao[]; standby: StandbyLinha[];
}) {
  const [f, setF] = useState({ orgId: orgs[0]?.id ?? "", titulo: "", frente: "", prazo: "", observacao: "" });
  const [parada, setParada] = useState({
    orgId: orgs[0]?.id ?? "", motivo: "inadimplencia",
    desde: new Date().toISOString().slice(0, 10), observacao: "",
  });
  const [abrindoParada, setAbrindoParada] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  /**
   * Mudança de status abre um campo de motivo em vez de aplicar direto.
   *
   * Não é fricção gratuita: o momento em que a informação existe é o momento da mudança. Pedir
   * depois nunca funciona — três semanas depois ninguém lembra por que travou, e é exatamente
   * essa a pergunta que aparece na reunião de prazo.
   */
  const [mudando, setMudando] = useState<{ id: string; para: string; motivo: string } | null>(null);
  const [vendoHistorico, setVendoHistorico] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const atrasadas = linhas.filter((l) => l.diasDeAtraso !== null)
    .sort((a, b) => (b.diasDeAtraso ?? 0) - (a.diasDeAtraso ?? 0));
  const entregues = linhas.filter((l) => l.status === "entregue").length;
  const abertas = linhas.filter((l) => l.status !== "entregue");

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
        <Kpi value={String(abertas.length)} label="Entregas em aberto" />
        <Kpi value={String(atrasadas.length)} label="Atrasadas" />
        <Kpi value={`${entregues}/${linhas.length || 0}`} label="Já entregues" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/*
        Stand-by vem ANTES do atraso, de propósito: se um projeto está parado esperando o cliente,
        essa é a primeira coisa que quem abre a tela precisa saber — inclusive para não cobrar a
        equipe por uma entrega que ninguém pode fazer.
      */}
      {standby.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--warn)]">
              Projetos parados
            </p>
            <p className="ds-small mt-1">
              O relógio do prazo está pausado. Ao retomar, os dias parados são somados aos prazos
              pendentes — o cliente não ganha prazo de graça, e a equipe não carrega atraso alheio.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr>{["Cliente", "Por quê", "Parado desde", "Há quanto tempo", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {standby.map((s) => (
                  <tr key={s.projectId}>
                    <td className="td font-medium text-[color:var(--fg-1)]">{s.cliente}</td>
                    <td className="td"><Badge tone="warn">{MOTIVO_ROTULO[s.motivo] ?? s.motivo}</Badge></td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(s.desde)}</td>
                    <td className="td font-jbmono text-[color:var(--fg-1)]">{s.dias} dia(s)</td>
                    <td className="td text-right">
                      <Button variant="ghost" size="sm" loading={pendente}
                        onClick={() => {
                          if (!confirm(`Retomar o projeto de ${s.cliente}? Os prazos pendentes serão empurrados em ${s.dias} dia(s).`)) return;
                          rodar(() => retomarProjetoDoCliente(s.projectId));
                        }}>
                        Retomar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {abrindoParada && (
        <Card title="Parar o projeto">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cliente">
              {(p) => <Select {...p} value={parada.orgId} onChange={(e) => setParada({ ...parada, orgId: e.target.value })}>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Select>}
            </Field>
            <Field label="Por quê">
              {(p) => <Select {...p} value={parada.motivo} onChange={(e) => setParada({ ...parada, motivo: e.target.value })}>
                {Object.entries(MOTIVO_ROTULO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="Parado desde" hint="A data em que a obra realmente parou, não a de hoje.">
              {(p) => <Input {...p} type="date" value={parada.desde}
                onChange={(e) => setParada({ ...parada, desde: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Observação">
              {(p) => <Textarea {...p} rows={2} value={parada.observacao}
                onChange={(e) => setParada({ ...parada, observacao: e.target.value })}
                placeholder="Ex.: parcela de implantação em aberto desde 26/07; retomamos assim que compensar." />}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await pararProjetoDoCliente(parada);
                setAbrindoParada(false);
              }, "Projeto em stand-by. O relógio do prazo está pausado.")}>
              Parar projeto
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindoParada(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Só aparece quando há atraso. Alerta permanente vira ruído. */}
      {atrasadas.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--danger)]">
              Devendo entrega
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr>{["Cliente", "O quê", "Prazo era", "Atraso", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {atrasadas.map((l) => (
                  <tr key={l.id}>
                    <td className="td font-medium text-[color:var(--fg-1)]">{l.cliente}</td>
                    <td className="td text-[color:var(--fg-2)]">
                      {l.titulo}
                      {l.frente && <span className="block text-xs text-[color:var(--fg-3)]">{l.frente}</span>}
                    </td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(l.prazo)}</td>
                    <td className="td">
                      <Badge tone="danger">{l.diasDeAtraso} dia{l.diasDeAtraso! > 1 ? "s" : ""}</Badge>
                    </td>
                    <td className="td text-right">
                      <Button variant="ghost" size="sm"
                        onClick={() => setMudando({ id: l.id, para: "entregue", motivo: "" })}>
                        Marcar entregue
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {abrindo ? (
        <Card title="Nova entrega">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              {(p) => <Select {...p} value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })}>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Select>}
            </Field>
            <Field label="O que será entregue">
              {(p) => <Input {...p} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })}
                placeholder="Ex.: Agente de atendimento no WhatsApp, ativo" />}
            </Field>
            <Field label="Frente" hint="Como você agrupa. Opcional.">
              {(p) => <Input {...p} value={f.frente} onChange={(e) => setF({ ...f, frente: e.target.value })}
                placeholder="Presença digital" />}
            </Field>
            <Field label="Prazo" hint="O atraso é calculado sozinho a partir daqui.">
              {(p) => <Input {...p} type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Observação">
              {(p) => <Textarea {...p} rows={2} value={f.observacao}
                onChange={(e) => setF({ ...f, observacao: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await criarEntrega(f);
                setAbrindo(false);
                setF({ ...f, titulo: "", frente: "", prazo: "", observacao: "" });
              }, "Entrega cadastrada.")}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => { setAbrindo(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setAbrindo(true)}>Nova entrega</Button>
          {!abrindoParada && (
            <Button variant="ghost" onClick={() => setAbrindoParada(true)}>Parar um projeto</Button>
          )}
        </div>
      )}

      {linhas.length === 0 ? (
        <EmptyState title="Nenhuma entrega cadastrada"
          description="Cadastre o que foi prometido em contrato. É o que permite responder, a qualquer momento, se estamos devendo alguma coisa a algum cliente." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr>{["Cliente", "O quê", "Situação", "Prazo", "Entregue em", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="td font-medium text-[color:var(--fg-1)]">{l.cliente}</td>
                    <td className="td text-[color:var(--fg-2)]">
                      {l.titulo}
                      {l.frente && <span className="block text-xs text-[color:var(--fg-3)]">{l.frente}</span>}
                      {l.observacao && <span className="block text-xs text-[color:var(--fg-3)]">{l.observacao}</span>}
                      {l.ultimoMotivo && (
                        <span className="mt-1 block text-xs italic text-[color:var(--fg-2)]">
                          “{l.ultimoMotivo}”
                        </span>
                      )}
                      {mudando?.id === l.id && (
                        <div className="mt-3 rounded-[8px] border border-hairline bg-[var(--bg-2)] p-3">
                          <p className="ds-small mb-2">
                            Mudando para <b>{STATUS_ROTULO[mudando.para] ?? mudando.para}</b>.{" "}
                            {mudando.para === "bloqueado"
                              ? "Diga o que travou — é o que permite destravar depois."
                              : "Quer registrar o motivo? (opcional)"}
                          </p>
                          <Input value={mudando.motivo} autoFocus
                            placeholder={mudando.para === "bloqueado"
                              ? "Ex.: parado até o cliente quitar a parcela de 26/07"
                              : "Ex.: validado com o cliente em reunião"}
                            onChange={(e) => setMudando({ ...mudando, motivo: e.target.value })} />
                          <div className="mt-3 flex gap-2">
                            <Button variant="primary" size="sm" loading={pendente}
                              onClick={() => {
                                const alvo = mudando;
                                rodar(() => mudarStatus(alvo.id, alvo.para, alvo.motivo), "Situação atualizada.");
                                setMudando(null);
                              }}>
                              Confirmar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setMudando(null)}>Cancelar</Button>
                          </div>
                        </div>
                      )}
                      {vendoHistorico === l.id && (
                        <div className="mt-3 space-y-2 border-l-2 border-hairline pl-3">
                          {l.historico.map((h, i) => (
                            <div key={i}>
                              <p className="text-xs text-[color:var(--fg-2)]">
                                {h.de ? `${STATUS_ROTULO[h.de] ?? h.de} → ` : ""}
                                <b>{STATUS_ROTULO[h.para] ?? h.para}</b>
                                <span className="text-[color:var(--fg-3)]"> · {data(h.quando)}</span>
                              </p>
                              {h.motivo && <p className="text-xs italic text-[color:var(--fg-3)]">“{h.motivo}”</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="td">
                      <Badge tone={STATUS_TOM[l.status] ?? "neutral"}>{STATUS_ROTULO[l.status] ?? l.status}</Badge>
                    </td>
                    <td className="td text-xs text-[color:var(--fg-2)]">
                      {data(l.prazo)}
                      {l.diasDeAtraso !== null && (
                        <span className="block text-[color:var(--danger)]">{l.diasDeAtraso} dia(s) de atraso</span>
                      )}
                      {l.standby && (
                        <span className="block text-[color:var(--warn)]">
                          parado há {l.standby.dias} dia(s) — {MOTIVO_ROTULO[l.standby.motivo] ?? l.standby.motivo}
                        </span>
                      )}
                    </td>
                    <td className="td text-xs text-[color:var(--fg-2)]">{data(l.entregueEm)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Select value={l.status} aria-label={`Situação de ${l.titulo}`}
                          onChange={(e) => setMudando({ id: l.id, para: e.target.value, motivo: "" })}
                          className="!w-auto !py-1 !text-xs">
                          {Object.entries(STATUS_ROTULO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        {l.historico.length > 0 && (
                          <Button variant="ghost" size="sm"
                            onClick={() => setVendoHistorico(vendoHistorico === l.id ? null : l.id)}>
                            {vendoHistorico === l.id ? "Fechar" : `Histórico (${l.historico.length})`}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm"
                          onClick={() => { if (confirm(`Remover "${l.titulo}"?`)) rodar(() => removerEntrega(l.id)); }}>
                          Remover
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
    </div>
  );
}
