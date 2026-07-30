"use client";
/**
 * Criador de Agentes — o assistente de 5 passos da academy antiga, no design system da Salestrack.
 *
 * A pessoa responde perguntas de negócio; o sistema monta o agente. Ela não escreve nem precisa
 * entender formato técnico — o resultado vem pronto para copiar.
 */
import { useMemo, useState, useTransition } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { salvarAgente } from "@/app/academy/agente/actions";
import { PASSOS, dadosVazios, gerarSystemPrompt, pendencias, type DadosAgente, type FerramentaRef } from "@/lib/academy/builder";

const TONS = ["Cordial e direto", "Formal e técnico", "Consultivo", "Objetivo e conciso"];
const FORMATOS = ["Resposta curta em texto", "Lista de tópicos", "Passo a passo numerado", "Resumo + recomendação"];

export function CriadorAgente({ catalogo, areas, agente }: {
  catalogo: FerramentaRef[]; areas: string[];
  /** Vindo de "Meus agentes" na barra lateral: abre o assistente já preenchido, para editar. */
  agente?: { id: string; dados: DadosAgente } | null;
}) {
  const [passo, setPasso] = useState(agente ? PASSOS.length - 1 : 0);
  const [d, setD] = useState<DadosAgente>(agente?.dados ?? dadosVazios());
  const [salvo, setSalvo] = useState(false);
  const [abaResultado, setAbaResultado] = useState("prompt");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const set = <K extends keyof DadosAgente>(k: K) => (v: DadosAgente[K]) => { setD((a) => ({ ...a, [k]: v })); setSalvo(false); };
  const resultado = useMemo(() => gerarSystemPrompt(d, catalogo), [d, catalogo]);
  const faltando = pendencias(d);

  const porCategoria = useMemo(() => {
    const m = new Map<string, FerramentaRef[]>();
    for (const f of catalogo) {
      const c = (f as FerramentaRef & { categoria?: string }).categoria ?? "Outras";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(f);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalogo]);

  function salvar() {
    setErro(null);
    iniciar(async () => {
      try {
        await salvarAgente({ id: agente?.id, dados: d, systemPrompt: resultado.systemPrompt, ferramentas: resultado.ferramentas });
        setSalvo(true);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  return (
    <div>
      {/* trilho dos 5 passos — igual ao da academy anterior */}
      <div className="acad-stepper">
        {PASSOS.map((nome, i) => (
          <div key={nome} className={`acad-step ${i < passo ? "is-done" : i === passo ? "is-current" : ""}`}>
            <button onClick={() => setPasso(i)} className="w-full" aria-current={i === passo ? "step" : undefined}>
              <span className="acad-step-circle">{i < passo ? "✓" : i + 1}</span>
              <span className="acad-step-label block">{nome}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="acad-card p-6 sm:p-7">
        <p className="mb-4 text-[12px] font-extrabold uppercase tracking-[.1em] text-[color:var(--cyan2)]">Passo {passo + 1} — {PASSOS[passo]}</p>
        {passo === 0 && (
          <div className="space-y-4">
            <Cabecalho titulo="Quem é o agente" desc="O básico: como ele se chama, onde atua e para que existe." />
            <label className="block">
                <span className="acad-lbl">Nome do agente</span>
                <input className="acad-input" value={d.nome} onChange={(e) => set("nome")(e.target.value)} placeholder="Ex.: Sofia — Atendimento" />
                <span className="acad-hint">Um nome próprio ajuda a equipe a se referir a ele.</span>
              </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="acad-lbl">Área</span>
                <select className="acad-input" value={d.area} onChange={(e) => set("area")(e.target.value)}>
                  <option value="">Escolha…</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                
              </label>
              <label className="block">
                <span className="acad-lbl">Empresa</span>
                <input className="acad-input" value={d.empresa} onChange={(e) => set("empresa")(e.target.value)} placeholder="Ex.: nome da empresa" />
                
              </label>
            </div>
            <label className="block">
                <span className="acad-lbl">Missão</span>
                <textarea className="acad-input" rows={3} value={d.missao} onChange={(e) => set("missao")(e.target.value)}
                placeholder="Ex.: Responder dúvidas de colaboradores sobre benefícios em até 2 minutos, sem envolver o RH." />
                <span className="acad-hint">Uma frase: o que ele faz, para quem, e qual resultado entrega.</span>
              </label>
            <label className="block">
                <span className="acad-lbl">Quem vai usar</span>
                <textarea className="acad-input" rows={3} value={d.usuarios} onChange={(e) => set("usuarios")(e.target.value)} />
                <span className="acad-hint">Perfil das pessoas e o que elas precisam.</span>
              </label>
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-4">
            <Cabecalho titulo="Como ele se comporta" desc="O jeito de responder e os limites do que pode fazer." />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="acad-lbl">Tom de voz</span>
                <select className="acad-input" value={d.tom} onChange={(e) => set("tom")(e.target.value)}>
                  <option value="">Escolha…</option>{TONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                
              </label>
              <label className="block">
                <span className="acad-lbl">Formato da resposta</span>
                <select className="acad-input" value={d.formato} onChange={(e) => set("formato")(e.target.value)}>
                  <option value="">Escolha…</option>{FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                
              </label>
            </div>
            <label className="block">
                <span className="acad-lbl">O que ele DEVE fazer</span>
                <textarea className="acad-input" rows={4} value={d.deve} onChange={(e) => set("deve")(e.target.value)}
                placeholder={"1. Confirmar a identidade antes de falar de dados pessoais\n2. Registrar todo atendimento no sistema"} />
                <span className="acad-hint">Uma obrigação por linha.</span>
              </label>
            <label className="block">
                <span className="acad-lbl">O que ele NUNCA deve fazer</span>
                <textarea className="acad-input" rows={4} value={d.nunca} onChange={(e) => set("nunca")(e.target.value)}
                placeholder={"1. Prometer prazo que não pode cumprir\n2. Divulgar salário de terceiros"} />
                <span className="acad-hint">Uma restrição por linha. É aqui que se evita a maioria dos problemas.</span>
              </label>
            <label className="block">
                <span className="acad-lbl">Contexto adicional</span>
                <textarea className="acad-input" rows={3} value={d.contexto} onChange={(e) => set("contexto")(e.target.value)} />
                <span className="acad-hint">Qualquer coisa que ele precise saber sobre a empresa ou o processo.</span>
              </label>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <Cabecalho titulo="O que ele consegue fazer" desc="Escolha as ferramentas que o agente vai poder usar. Elas dão a ele acesso a sistemas reais." />
            {porCategoria.length === 0 ? (
              <p className="text-[13px] text-[color:var(--acad-muted)]">Nenhuma ferramenta no catálogo ainda.</p>
            ) : (
              <div className="space-y-4">
                {porCategoria.map(([cat, itens]) => (
                  <div key={cat}>
                    <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[color:var(--acad-muted)]">{cat}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {itens.map((f) => {
                        const marcado = d.tools.includes(f.chave);
                        return (
                          <button key={f.chave} onClick={() => set("tools")(marcado ? d.tools.filter((c) => c !== f.chave) : [...d.tools, f.chave])}
                            aria-pressed={marcado}
                            className={`acad-tool ${marcado ? "is-on" : ""}`}>
                            <span className="block text-[13px] font-bold text-[color:var(--navy)]">{f.nome}</span>
                            <span className="mt-0.5 block line-clamp-2 text-[12px] text-[color:var(--acad-muted)]">{f.conteudo}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className="block">
                <span className="acad-lbl">Alguma coisa que falta no catálogo?</span>
                <textarea className="acad-input" rows={3} value={d.toolsExtra} onChange={(e) => set("toolsExtra")(e.target.value)}
                placeholder="Ex.: consultar saldo de férias no sistema da folha" />
                <span className="acad-hint">Descreva em português. O time técnico traduz depois.</span>
              </label>
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-4">
            <Cabecalho titulo="Segurança" desc="Quando ele deve parar e chamar uma pessoa, e como se proteger de uso indevido." />
            <label className="block">
                <span className="acad-lbl">Quando transferir para um humano</span>
                <textarea className="acad-input" rows={4} value={d.escalacao} onChange={(e) => set("escalacao")(e.target.value)}
                placeholder={"- Cliente irritado ou pedindo cancelamento\n- Valor acima de R$ 5.000\n- Assunto jurídico"} />
                <span className="acad-hint">Um gatilho por linha.</span>
              </label>
            <label className="block">
                <span className="acad-lbl">Regras de proteção</span>
                <textarea className="acad-input" rows={5} value={d.seguranca} onChange={(e) => set("seguranca")(e.target.value)}
                placeholder="Deixe em branco para usar as regras padrão." />
                <span className="acad-hint">Em branco, o sistema aplica um conjunto padrão que cobre os riscos mais comuns.</span>
              </label>
          </div>
        )}

        {passo === 4 && (
          <div className="space-y-4">
            <div className="acad-ok">
              <p className="text-[15px] font-extrabold text-[color:var(--green)]">
                {d.nome ? `Agente "${d.nome}" pronto!` : "Seu agente está quase pronto"}
              </p>
              <p className="mt-0.5 text-[13px] text-[color:var(--acad-text)]">
                Copie as instruções e cole no Claude. A lista de ferramentas vai para quem for implementar.
              </p>
            </div>

            {faltando.length > 0 && (
              <div className="acad-card p-4">
                <p className="text-[13px] font-bold text-[color:var(--navy)]">Dá para melhorar antes de usar</p>
                <ul className="mt-1.5 space-y-1">
                  {faltando.map((f) => <li key={f} className="text-[12px] text-[color:var(--acad-muted)]">• Falta {f}.</li>)}
                </ul>
              </div>
            )}

            <div className="acad-tabs">
              {[["prompt", "🖊️ Instruções do agente"], ["tools", "🔧 Ferramentas"], ["brief", "📋 Resumo"]].map(([k, rot]) => (
                <button key={k} onClick={() => setAbaResultado(k)} className={`acad-tab ${abaResultado === k ? "is-active" : ""}`}>{rot}</button>
              ))}
            </div>

            {abaResultado === "prompt" && (
              <div className="acad-code">
                <div className="acad-code-head">
                  <span>Instruções — {d.nome || "seu agente"}</span>
                  <CopyButton text={resultado.systemPrompt} label="Copiar" className="acad-code-btn shrink-0" />
                </div>
                <pre className="acad-code-body">{resultado.systemPrompt}</pre>
              </div>
            )}

            {abaResultado === "tools" && (
              resultado.ferramentas.length === 0
                ? <p className="text-[13px] text-[color:var(--acad-muted)]">Nenhuma ferramenta escolhida. Volte ao passo 3 se o agente precisar acessar algum sistema.</p>
                : <div className="space-y-3">
                    {resultado.ferramentas.map((f) => (
                      <div key={f.name} className="acad-card p-4">
                        <p className="font-mono text-[13px] font-bold text-[color:var(--cyan2)]">{f.name}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--acad-text)]">{f.description}</p>
                        <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-[color:var(--acad-muted)]">O que recebe</p>
                        <ul className="mt-1 space-y-0.5">
                          {Object.entries(f.input_schema.properties).map(([nome, campo]) => (
                            <li key={nome} className="text-[12px] text-[color:var(--acad-text)]">
                              <span className="font-mono">{nome}</span>
                              <span className={`acad-badge ml-1.5 ${f.input_schema.required.includes(nome) ? "acad-badge-green" : "acad-badge-amber"}`}>
                                {f.input_schema.required.includes(nome) ? "obrigatório" : "opcional"}
                              </span>
                              <span className="ml-1 text-[color:var(--acad-muted)]">{campo.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {/* O formato técnico é para o desenvolvedor, não para o aluno: fica no botão de
                        copiar, nunca na tela. Ver as ferramentas legíveis é o que a pessoa precisa aqui. */}
                    <div className="acad-card flex flex-wrap items-center justify-between gap-3 p-4">
                      <p className="text-[13px] text-[color:var(--acad-text)]">
                        Quem for implementar precisa da especificação técnica destas {resultado.ferramentas.length} ferramenta(s).
                        Copie e envie para a pessoa desenvolvedora — você não precisa entender o conteúdo.
                      </p>
                      <CopyButton text={JSON.stringify(resultado.ferramentas, null, 2)}
                        label="Copiar especificação técnica" className="acad-btn-copy shrink-0" />
                    </div>
                  </div>
            )}

            {abaResultado === "brief" && (
              <div className="acad-card p-5">
                <dl className="space-y-3">
                  {[["Nome", d.nome], ["Área", d.area], ["Empresa", d.empresa], ["Missão", d.missao],
                    ["Quem usa", d.usuarios], ["Tom", d.tom], ["Formato", d.formato],
                    ["Ferramentas", `${resultado.ferramentas.length} escolhida(s)`]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[color:var(--acad-muted)]">{k}</dt>
                      <dd className="mt-0.5 text-[13px] text-[color:var(--acad-text)]">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--acad-border)] pt-4">
              <button onClick={salvar} disabled={pendente || !d.nome.trim()} className="acad-btn-cyan disabled:opacity-50">
                {pendente ? "Salvando…" : "Salvar meu agente"}
              </button>
              {salvo && <span className="text-[13px] font-semibold text-[color:var(--green)]">Salvo. Ele aparece na barra lateral.</span>}
              {erro && <span className="text-[13px] text-[color:var(--red)]">{erro}</span>}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[color:var(--acad-border)] pt-4">
          <button onClick={() => setPasso((p) => Math.max(0, p - 1))} disabled={passo === 0}
            className="text-[13px] font-semibold text-[color:var(--acad-muted)] disabled:opacity-40">← Voltar</button>
          <button onClick={() => setPasso((p) => Math.min(PASSOS.length - 1, p + 1))} disabled={passo === PASSOS.length - 1}
            className="text-[13px] font-bold text-[color:var(--cyan2)] disabled:opacity-40">Avançar →</button>
        </div>
      </div>
    </div>
  );
}

function Cabecalho({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div>
      <h2 className="text-[18px] font-extrabold text-[color:var(--navy)]">{titulo}</h2>
      <p className="mt-1 text-[13px] text-[color:var(--acad-muted)]">{desc}</p>
    </div>
  );
}
