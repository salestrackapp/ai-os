"use client";
/**
 * Direitos do titular — a tela de quem ATENDE o pedido, não de quem programou o sistema.
 *
 * Regra que manda aqui: nada do banco chega cru à tela. O inventário vira ficha em português,
 * o prazo vira "faltam 9 dias", e a exclusão diz em uma frase o que apaga e o que preserva —
 * porque quem clica precisa saber o que está fazendo antes, não descobrir depois.
 */
import { useState, useTransition } from "react";
import { dataBR } from "@/lib/formato/data";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, EmptyState, Kpi } from "@/components/ds";
import { consultarTitular, registrarPedido, concluirPedido, excluirAgora } from "@/app/admin/lgpd/actions";
import type { FichaTitular } from "@/app/admin/lgpd/actions";

export type PedidoLinha = {
  id: string; tipo: string; status: string; email: string; nome: string | null;
  detalhe: string | null; resposta: string | null;
  recebidoEm: string; prazoEm: string; concluidoEm: string | null;
};

const TIPO_LEGIVEL: Record<string, string> = {
  acesso: "Quer saber o que temos sobre ela",
  exclusao: "Quer que apaguemos os dados",
  portabilidade: "Quer levar os dados embora",
  correcao: "Quer corrigir um dado errado",
  oposicao: "Não quer mais ser tratada assim",
  revogacao: "Retirou o consentimento",
};
const ESTADO_LEGIVEL: Record<string, string> = {
  concedido: "autorizou", negado: "não autorizou", revogado: "cancelou depois",
};
const FINALIDADE_LEGIVEL: Record<string, string> = {
  marketing: "Conteúdo e novidades", transacional: "Resposta ao que pediu",
  prospeccao: "Abordagem comercial", academy: "Formação", pesquisa: "Pesquisa",
};
const BASE_LEGIVEL: Record<string, string> = {
  consentimento: "consentimento", legitimo_interesse: "legítimo interesse",
  execucao_contrato: "execução de contrato", obrigacao_legal: "obrigação legal",
};

const data = dataBR;   // trata coluna `date` sem deixar o fuso puxar o dia para trás

/** "faltam 9 dias" diz mais que uma data — o prazo do art. 19 é o que aperta. */
function prazoTexto(prazo: string): { texto: string; tom: "success" | "warn" | "danger" } {
  const dias = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { texto: `${Math.abs(dias)} dia(s) em atraso`, tom: "danger" };
  if (dias === 0) return { texto: "vence hoje", tom: "danger" };
  if (dias <= 5) return { texto: `faltam ${dias} dia(s)`, tom: "warn" };
  return { texto: `faltam ${dias} dias`, tom: "success" };
}

export function PainelLgpd({ pedidos }: { pedidos: PedidoLinha[] }) {
  const [busca, setBusca] = useState("");
  const [ficha, setFicha] = useState<FichaTitular | null>(null);
  const [novo, setNovo] = useState({ tipo: "acesso", email: "", nome: "", detalhe: "" });
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const abertos = pedidos.filter((p) => !p.concluidoEm);
  const atrasados = abertos.filter((p) => new Date(p.prazoEm).getTime() < Date.now()).length;

  /**
   * `revalidatePath` na Server Action invalida o cache do servidor, mas não força ESTA árvore a
   * re-renderizar — os números do topo continuavam mostrando o estado anterior enquanto a mensagem
   * dizia que tinha dado certo. Quem opera lê os dois e conclui que falhou. `router.refresh()`
   * puxa o RSC atualizado; sem ele, a confirmação e a tela se contradizem.
   */
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
        <Kpi value={String(abertos.length)} label="Pedidos abertos" />
        <Kpi value={String(atrasados)} label="Fora do prazo de 15 dias" />
        <Kpi value={String(pedidos.length - abertos.length)} label="Já atendidos" />
      </div>

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/* ── Consulta ───────────────────────────────────────────────────────── */}
      <Card title="O que temos sobre uma pessoa">
        <p className="ds-small mb-4">Digite o e-mail. Só consulta — nada é alterado.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <Field label="E-mail do titular">
              {(p) => <Input {...p} type="email" value={busca} placeholder="pessoa@empresa.com.br"
                onChange={(e) => setBusca(e.target.value)} />}
            </Field>
          </div>
          <Button variant="primary" loading={pendente}
            onClick={() => rodar(async () => setFicha(await consultarTitular(busca)))}>
            Consultar
          </Button>
        </div>

        {ficha && (
          <div className="mt-6 border-t border-hairline pt-5">
            <p className="ds-h3">{ficha.email}</p>
            {ficha.vazio ? (
              <p className="ds-body mt-2">
                Não temos nenhum dado desta pessoa. Se ela pediu exclusão, a resposta já está pronta:
                não havia o que apagar.
              </p>
            ) : (
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Bloco titulo="No CRM">
                  {ficha.contatos.length === 0 ? <Nada /> : ficha.contatos.map((c, i) => (
                    <Linha key={i} principal={c.nome}
                      apoio={`${c.empresa ?? "sem empresa"} · desde ${data(c.desde)}`} />
                  ))}
                </Bloco>
                <Bloco titulo="Negócios">
                  {ficha.negocios.length === 0 ? <Nada /> : ficha.negocios.map((d, i) => (
                    <Linha key={i} principal={d.titulo} apoio={`${d.etapa} · ${data(d.criadoEm)}`} />
                  ))}
                </Bloco>
                <Bloco titulo="Como chegou até nós">
                  {ficha.leads.length === 0 ? <Nada /> : ficha.leads.map((l, i) => (
                    <Linha key={i} principal={l.origem}
                      apoio={`${data(l.quando)}${l.mensagem ? ` · "${l.mensagem.slice(0, 60)}"` : ""}`} />
                  ))}
                </Bloco>
                <Bloco titulo="O que ela autorizou">
                  {ficha.consentimentos.length === 0 ? <Nada /> : ficha.consentimentos.map((c, i) => (
                    <Linha key={i}
                      principal={`${FINALIDADE_LEGIVEL[c.finalidade] ?? c.finalidade}: ${ESTADO_LEGIVEL[c.estado] ?? c.estado}`}
                      apoio={`base: ${BASE_LEGIVEL[c.base] ?? c.base} · ${data(c.quando)}`} />
                  ))}
                </Bloco>
                <Bloco titulo="Mensagens que enviamos">
                  {ficha.envios.length === 0 ? <Nada /> : ficha.envios.slice(0, 6).map((e, i) => (
                    <Linha key={i} principal={`${e.canal} — ${e.status}`} apoio={data(e.quando)} />
                  ))}
                </Bloco>
                <Bloco titulo="Prospecção e campanhas">
                  <Linha principal={`${ficha.prospeccao} registro(s) de prospecção`}
                    apoio={`${ficha.toques} toque(s) de campanha`} />
                </Bloco>
              </div>
            )}

            {!ficha.vazio && (
              <div className="mt-6 rounded-[10px] border border-[color:var(--danger)] bg-[color:var(--bg-2)] p-4">
                <p className="ds-body font-semibold">Apagar tudo desta pessoa</p>
                <p className="ds-small mt-1">
                  Apaga contato, negócios sem contrato, leads, prospecção, campanhas e consentimentos.
                  <b> Preserva</b> o registro de auditoria e anonimiza contratos e propostas assinados —
                  esses a lei manda guardar. Não tem como desfazer.
                </p>
                <div className="mt-3">
                  <Button variant="secondary" loading={pendente}
                    className="!border-[color:var(--danger)] !text-[color:var(--danger)]"
                    onClick={() => {
                      if (!confirm(`Apagar todos os dados de ${ficha.email}? Não há como desfazer.`)) return;
                      rodar(async () => { await excluirAgora(ficha.email); setFicha(null); },
                        "Dados apagados e o pedido registrado no histórico.");
                    }}>
                    Apagar os dados de {ficha.email}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Novo pedido ────────────────────────────────────────────────────── */}
      {abrindo ? (
        <Card title="Registrar um pedido">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="O que a pessoa quer">
              {(p) => <Select {...p} value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
                {Object.entries(TIPO_LEGIVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>}
            </Field>
            <Field label="E-mail dela">
              {(p) => <Input {...p} type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />}
            </Field>
            <Field label="Nome">
              {(p) => <Input {...p} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="O que ela pediu, nas palavras dela"
              hint="Copie o texto do e-mail ou da mensagem. É o que sustenta a resposta depois.">
              {(p) => <Textarea {...p} rows={3} value={novo.detalhe} onChange={(e) => setNovo({ ...novo, detalhe: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await registrarPedido(novo);
                setAbrindo(false); setNovo({ tipo: "acesso", email: "", nome: "", detalhe: "" });
              }, "Pedido registrado. O prazo de 15 dias começou a contar.")}>
              Registrar pedido
            </Button>
            <Button variant="ghost" onClick={() => setAbrindo(false)}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setAbrindo(true)}>Registrar um pedido</Button>
      )}

      {/* ── Pedidos ────────────────────────────────────────────────────────── */}
      {pedidos.length === 0 ? (
        <EmptyState title="Nenhum pedido até agora"
          description="Quando alguém pedir acesso, correção ou exclusão dos próprios dados, registre aqui — o prazo de resposta passa a ser acompanhado sozinho." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr>
                {["Pessoa", "O que quer", "Recebido", "Prazo", ""].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {pedidos.map((p) => {
                  const pr = prazoTexto(p.prazoEm);
                  return (
                    <tr key={p.id}>
                      <td className="td">
                        <span className="block font-medium text-[color:var(--fg-1)]">{p.nome ?? p.email}</span>
                        {p.nome && <span className="block text-xs text-[color:var(--fg-3)]">{p.email}</span>}
                      </td>
                      <td className="td text-[color:var(--fg-2)]">{TIPO_LEGIVEL[p.tipo] ?? p.tipo}</td>
                      <td className="td text-[color:var(--fg-2)]">{data(p.recebidoEm)}</td>
                      <td className="td">
                        {p.concluidoEm
                          ? <Badge tone="success">atendido em {data(p.concluidoEm)}</Badge>
                          : <Badge tone={pr.tom}>{pr.texto}</Badge>}
                      </td>
                      <td className="td text-right">
                        {!p.concluidoEm && (
                          <Button variant="ghost" size="sm" loading={pendente}
                            onClick={() => {
                              const apaga = p.tipo === "exclusao" || p.tipo === "revogacao";
                              const q = apaga
                                ? `Concluir e APAGAR os dados de ${p.email}? Não há como desfazer.`
                                : `Marcar o pedido de ${p.email} como atendido?`;
                              if (!confirm(q)) return;
                              rodar(() => concluirPedido(p.id, ""), "Pedido concluído.");
                            }}>
                            {p.tipo === "exclusao" || p.tipo === "revogacao" ? "Concluir e apagar" : "Marcar atendido"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.1em] text-[color:var(--fg-3)]">{titulo}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}
function Linha({ principal, apoio }: { principal: string; apoio?: string }) {
  return (
    <div>
      <p className="ds-body text-[color:var(--fg-1)]">{principal}</p>
      {apoio && <p className="ds-small text-[color:var(--fg-3)]">{apoio}</p>}
    </div>
  );
}
const Nada = () => <p className="ds-small text-[color:var(--fg-3)]">nada registrado</p>;
