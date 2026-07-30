"use client";
/**
 * Gestão dos agentes de IA.
 *
 * Os 6 prompts existiam desde julho e só mudavam por SQL — um agente que não se ajusta pela
 * interface é um agente que ninguém ajusta, e ajustar prompt é o trabalho principal de quem opera
 * IA.
 *
 * Três coisas que a tela faz e que a falta delas explicava o problema:
 *  · **testar antes de publicar** — publicar para descobrir se ficou bom faz do cliente a cobaia;
 *  · **versionar com motivo** — quando o agente piora depois de um ajuste, é preciso saber o que
 *    mudou e poder voltar;
 *  · **nome legível** — "prospect_writer" não diz a ninguém o que o agente faz.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Select, Textarea, Badge, Kpi } from "@/components/ds";
import { dataHoraBR } from "@/lib/formato/data";
import { publicarVersao, reverterPara, testarAgente, criarAgente, rodarAvulso, arquivarAgente } from "@/app/admin/agentes/actions";

export type VersaoLinha = {
  versao: number; ativo: boolean; systemPrompt: string; motivo: string | null; quando: string;
};

export type GatilhoOpcao = { chave: string; rotulo: string; descricao: string; recebe: string; inscritos: number };

export type AgenteLinha = {
  agentKey: string; titulo: string; descricao: string | null;
  tipo: "sistema" | "avulso" | "gatilho"; gatilho: string | null; instrucaoContexto: string | null;
  ultimaRodada: string | null;
  systemPrompt: string; versao: number;
  modelo: string | null; maxTokens: number | null; temperatura: number | null;
  versoes: VersaoLinha[];
  execucoes: number; custoUsd: number; falhas: number;
};

const MODELOS = [
  { valor: "", rotulo: "usar o padrão do sistema" },
  { valor: "claude-opus-5", rotulo: "Opus 5 — mais capaz, mais caro" },
  { valor: "claude-sonnet-5", rotulo: "Sonnet 5 — equilíbrio" },
  { valor: "claude-haiku-4-5-20251001", rotulo: "Haiku 4.5 — rápido e barato" },
];

const TIPO_ROTULO: Record<string, string> = {
  sistema: "do sistema", avulso: "sob demanda", gatilho: "automático",
};

export function Agentes({ agentes, temHistorico, gatilhos }: {
  agentes: AgenteLinha[]; temHistorico: boolean; gatilhos: GatilhoOpcao[];
}) {
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({
    titulo: "", descricao: "", tipo: "avulso" as "avulso" | "gatilho", gatilho: "",
    systemPrompt: "", instrucaoContexto: "", modelo: "", maxTokens: "",
  });
  const [rodando, setRodando] = useState<{ key: string; contexto: string; resposta: string | null } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, { prompt: string; motivo: string; modelo: string; maxTokens: string; temperatura: string }>>({});
  const [teste, setTeste] = useState<{ pergunta: string; resposta: string | null }>({ pergunta: "", resposta: null });
  const [vendoHistorico, setVendoHistorico] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const custoTotal = agentes.reduce((s, a) => s + a.custoUsd, 0);
  const falhasTotal = agentes.reduce((s, a) => s + a.falhas, 0);

  const doAgente = (a: AgenteLinha) => rascunho[a.agentKey] ?? {
    prompt: a.systemPrompt, motivo: "", modelo: a.modelo ?? "",
    maxTokens: a.maxTokens ? String(a.maxTokens) : "", temperatura: a.temperatura != null ? String(a.temperatura) : "",
  };
  const setDoAgente = (key: string, patch: Partial<ReturnType<typeof doAgente>>) =>
    setRascunho((r) => ({ ...r, [key]: { ...(r[key] ?? doAgente(agentes.find((a) => a.agentKey === key)!)), ...patch } }));

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
        <Kpi value={String(agentes.length)} label="Agentes ativos" />
        <Kpi value={temHistorico ? `US$ ${custoTotal.toFixed(2)}` : "—"} label="Custo registrado" />
        <Kpi value={temHistorico ? String(falhasTotal) : "—"} label="Falhas recentes" />
      </div>

      {!temHistorico && (
        <Card>
          <p className="ds-small">
            O custo e as falhas por agente aparecem quando o registro de execuções estiver ligado
            (item 12 de <b>docs/CONFIG_PENDENTE.md</b>). Os agentes já funcionam — o que falta é o
            histórico.
          </p>
        </Card>
      )}

      {erro && <p className="text-sm text-[color:var(--danger)]">{erro}</p>}
      {aviso && <p className="text-sm text-[color:var(--success)]">{aviso}</p>}

      {/* ── Criar ─────────────────────────────────────────────────────────── */}
      {criando ? (
        <Card title="Novo agente">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" hint="Como você vai reconhecê-lo na lista.">
              {(p) => <Input {...p} value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
                placeholder="Ex.: Revisor de proposta" />}
            </Field>
            <Field label="O que ele faz" hint="Uma linha, para quem abrir a tela depois.">
              {(p) => <Input {...p} value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />}
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Quando ele roda?"
              hint="Um agente sem quem o chame nunca roda — por isso a pergunta é obrigatória.">
              {(p) => <Select {...p} value={novo.tipo}
                onChange={(e) => setNovo({ ...novo, tipo: e.target.value as "avulso" | "gatilho" })}>
                <option value="avulso">Quando eu mandar — colo o conteúdo e ele responde</option>
                <option value="gatilho">Sozinho, quando algo acontece no sistema</option>
              </Select>}
            </Field>
          </div>

          {novo.tipo === "gatilho" ? (
            <div className="mt-4">
              <Field label="Qual evento dispara">
                {(p) => <Select {...p} value={novo.gatilho} onChange={(e) => setNovo({ ...novo, gatilho: e.target.value })}>
                  <option value="">— escolha o evento —</option>
                  {gatilhos.map((g) => (
                    <option key={g.chave} value={g.chave}>
                      {g.rotulo}{g.inscritos > 0 ? ` (${g.inscritos} agente(s) já escutam)` : ""}
                    </option>
                  ))}
                </Select>}
              </Field>
              {novo.gatilho && (
                <p className="ds-small mt-2 text-[color:var(--fg-3)]">
                  O agente recebe: {gatilhos.find((g) => g.chave === novo.gatilho)?.recebe}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <Field label="O que você vai colar" hint="Aparece como instrução na hora de rodar.">
                {(p) => <Input {...p} value={novo.instrucaoContexto}
                  onChange={(e) => setNovo({ ...novo, instrucaoContexto: e.target.value })}
                  placeholder="Ex.: cole aqui o texto da proposta" />}
              </Field>
            </div>
          )}

          <div className="mt-4">
            <Field label="Instruções do agente"
              hint="Escreva como explicaria a uma pessoa nova: o que fazer, com que tom, e o que nunca fazer.">
              {(p) => <Textarea {...p} rows={8} value={novo.systemPrompt}
                onChange={(e) => setNovo({ ...novo, systemPrompt: e.target.value })}
                placeholder="Você é o revisor de propostas da Salestrack. Leia a proposta e aponte: o que está vago, o que promete sem prazo, e o que o cliente pode entender errado. Seja específico e cite o trecho." />}
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Modelo">
              {(p) => <Select {...p} value={novo.modelo} onChange={(e) => setNovo({ ...novo, modelo: e.target.value })}>
                {MODELOS.map((mo) => <option key={mo.valor} value={mo.valor}>{mo.rotulo}</option>)}
              </Select>}
            </Field>
            <Field label="Tamanho máximo da resposta" hint="Em tokens. Vazio usa o padrão.">
              {(p) => <Input {...p} type="number" min={64} max={8192} value={novo.maxTokens}
                onChange={(e) => setNovo({ ...novo, maxTokens: e.target.value })} />}
            </Field>
          </div>

          <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
            <Button variant="primary" loading={pendente}
              onClick={() => rodar(async () => {
                await criarAgente(novo);
                setCriando(false);
                setNovo({ titulo: "", descricao: "", tipo: "avulso", gatilho: "",
                  systemPrompt: "", instrucaoContexto: "", modelo: "", maxTokens: "" });
              }, "Agente criado.")}>
              Criar agente
            </Button>
            <Button variant="ghost" onClick={() => { setCriando(false); setErro(null); }}>Cancelar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setCriando(true)}>Novo agente</Button>
      )}

      <div className="space-y-4">
        {agentes.map((a) => {
          const r = doAgente(a);
          const editando = aberto === a.agentKey;
          const mudou = r.prompt.trim() !== a.systemPrompt.trim();

          return (
            <Card key={a.agentKey} className="p-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[color:var(--fg-1)]">{a.titulo}</p>
                  {a.descricao && <p className="ds-small text-[color:var(--fg-3)]">{a.descricao}</p>}
                </div>
                <Badge tone={a.tipo === "gatilho" ? "brand" : a.tipo === "avulso" ? "success" : "neutral"}>
                  {TIPO_ROTULO[a.tipo]}
                </Badge>
                {a.gatilho && (
                  <span className="text-xs text-[color:var(--fg-3)]">
                    {gatilhos.find((g) => g.chave === a.gatilho)?.rotulo ?? a.gatilho}
                  </span>
                )}
                <Badge tone="neutral">v{a.versao}</Badge>
                {a.modelo && <Badge tone="brand">{a.modelo.replace("claude-", "")}</Badge>}
                {temHistorico && a.execucoes > 0 && (
                  <span className="font-jbmono text-xs text-[color:var(--fg-3)]">
                    {a.execucoes} exec · US$ {a.custoUsd.toFixed(3)}
                    {a.falhas > 0 && <span className="text-[color:var(--danger)]"> · {a.falhas} falha(s)</span>}
                  </span>
                )}
                <div className="flex gap-1">
                  {a.versoes.length > 1 && (
                    <Button variant="ghost" size="sm"
                      onClick={() => setVendoHistorico(vendoHistorico === a.agentKey ? null : a.agentKey)}>
                      {vendoHistorico === a.agentKey ? "Fechar" : `Versões (${a.versoes.length})`}
                    </Button>
                  )}
                  {a.tipo === "avulso" && (
                    <Button variant="primary" size="sm"
                      onClick={() => setRodando(rodando?.key === a.agentKey ? null : { key: a.agentKey, contexto: "", resposta: null })}>
                      {rodando?.key === a.agentKey ? "Fechar" : "Rodar"}
                    </Button>
                  )}
                  <Button variant={editando ? "ghost" : "secondary"} size="sm"
                    onClick={() => { setAberto(editando ? null : a.agentKey); setTeste({ pergunta: "", resposta: null }); }}>
                    {editando ? "Fechar" : "Ajustar"}
                  </Button>
                  {a.tipo !== "sistema" && (
                    <Button variant="ghost" size="sm"
                      onClick={() => {
                        if (!confirm(`Arquivar "${a.titulo}"? Ele para de rodar; o histórico fica.`)) return;
                        rodar(() => arquivarAgente(a.agentKey), "Agente arquivado.");
                      }}>
                      Arquivar
                    </Button>
                  )}
                </div>
              </div>

              {rodando?.key === a.agentKey && (
                <div className="border-b border-hairline px-6 py-5">
                  <Field label={a.instrucaoContexto ?? "Cole o conteúdo a analisar"}>
                    {(p) => <Textarea {...p} rows={7} value={rodando.contexto}
                      onChange={(e) => setRodando({ ...rodando, contexto: e.target.value })} />}
                  </Field>
                  <div className="mt-3">
                    <Button variant="primary" loading={pendente}
                      onClick={() => rodar(async () => {
                        const resp = await rodarAvulso({ agentKey: a.agentKey, contexto: rodando.contexto });
                        setRodando({ ...rodando, resposta: resp });
                      })}>
                      Rodar agente
                    </Button>
                  </div>
                  {rodando.resposta && (
                    <pre className="mt-4 whitespace-pre-wrap rounded-[8px] border border-hairline bg-[var(--bg-2)] p-4 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-1)]">
                      {rodando.resposta}
                    </pre>
                  )}
                </div>
              )}

              {vendoHistorico === a.agentKey && (
                <div className="space-y-2 border-b border-hairline bg-[var(--bg-2)] px-6 py-4">
                  {a.versoes.map((v) => (
                    <div key={v.versao} className="flex flex-wrap items-center gap-2">
                      <Badge tone={v.ativo ? "success" : "neutral"}>v{v.versao}{v.ativo ? " · em uso" : ""}</Badge>
                      <span className="text-xs text-[color:var(--fg-3)]">{dataHoraBR(v.quando)}</span>
                      {v.motivo && <span className="text-xs italic text-[color:var(--fg-2)]">“{v.motivo}”</span>}
                      {!v.ativo && (
                        <Button variant="ghost" size="sm" loading={pendente}
                          onClick={() => {
                            if (!confirm(`Voltar o "${a.titulo}" para a versão ${v.versao}?`)) return;
                            rodar(() => reverterPara(a.agentKey, v.versao), `Voltou para a v${v.versao}.`);
                          }}>
                          Voltar para esta
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editando && (
                <div className="px-6 py-5">
                  <Field label="Instruções do agente"
                    hint="É o que define como ele se comporta. Escreva como explicaria a uma pessoa nova na equipe.">
                    {(p) => <Textarea {...p} rows={10} value={r.prompt}
                      onChange={(e) => setDoAgente(a.agentKey, { prompt: e.target.value })} />}
                  </Field>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Modelo" hint="Só mude se souber por quê — o padrão serve para quase tudo.">
                      {(p) => <Select {...p} value={r.modelo}
                        onChange={(e) => setDoAgente(a.agentKey, { modelo: e.target.value })}>
                        {MODELOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
                      </Select>}
                    </Field>
                    <Field label="Tamanho máximo da resposta" hint="Em tokens. Vazio usa o padrão.">
                      {(p) => <Input {...p} type="number" min={64} max={8192} value={r.maxTokens}
                        onChange={(e) => setDoAgente(a.agentKey, { maxTokens: e.target.value })} />}
                    </Field>
                    <Field label="Criatividade" hint="0 = previsível, 1 = variado. Vazio usa o padrão.">
                      {(p) => <Input {...p} type="number" min={0} max={1} step={0.1} value={r.temperatura}
                        onChange={(e) => setDoAgente(a.agentKey, { temperatura: e.target.value })} />}
                    </Field>
                  </div>

                  {/* Testar vem ANTES de publicar, na ordem da tela e na ordem do trabalho. */}
                  <div className="mt-5 rounded-[10px] border border-hairline bg-[var(--bg-2)] p-4">
                    <p className="ds-small mb-2 font-semibold">Testar antes de publicar</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[280px] flex-1">
                        <Field label="Pergunta de teste">
                          {(p) => <Input {...p} value={teste.pergunta}
                            placeholder="Escreva algo que um usuário perguntaria"
                            onChange={(e) => setTeste({ ...teste, pergunta: e.target.value })} />}
                        </Field>
                      </div>
                      <Button variant="secondary" loading={pendente}
                        onClick={() => rodar(async () => {
                          const res = await testarAgente({
                            agentKey: a.agentKey, systemPrompt: r.prompt, pergunta: teste.pergunta,
                          });
                          setTeste({ ...teste, resposta: res.degradado
                            ? `(indisponível) ${res.resposta}` : `${res.resposta}\n\n— ${res.tokens} tokens` });
                        })}>
                        Testar
                      </Button>
                    </div>
                    {teste.resposta && (
                      <pre className="mt-3 whitespace-pre-wrap rounded-[8px] bg-[var(--bg-1)] p-3 font-montserrat text-[13px] leading-relaxed text-[color:var(--fg-2)]">
                        {teste.resposta}
                      </pre>
                    )}
                  </div>

                  <div className="mt-5">
                    <Field label="O que mudou nesta versão?"
                      hint="Fica no histórico. É o que permite entender, depois, por que o agente mudou de comportamento.">
                      {(p) => <Input {...p} value={r.motivo}
                        onChange={(e) => setDoAgente(a.agentKey, { motivo: e.target.value })} />}
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
                    <Button variant="primary" loading={pendente}
                      onClick={() => rodar(async () => {
                        await publicarVersao({ agentKey: a.agentKey, systemPrompt: r.prompt, motivo: r.motivo,
                          modelo: r.modelo, maxTokens: r.maxTokens, temperatura: r.temperatura });
                        setAberto(null);
                        setRascunho((x) => { const y = { ...x }; delete y[a.agentKey]; return y; });
                      }, "Nova versão publicada. A anterior ficou no histórico.")}>
                      Publicar versão {a.versao + 1}
                    </Button>
                    {mudou && <span className="ds-small text-[color:var(--warn)]">há alterações não publicadas</span>}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
