import { sanitizeEmailHtml } from "@/lib/relacionamento/sanitize-email";
import { CopyButton } from "@/components/ui/CopyButton";
import { corDoNivel, type Bloco } from "@/lib/academy/blocks";

/**
 * Os 19 renderizadores de bloco da trilha, portados de renderSection() da academy antiga.
 * Ficam num arquivo só porque são pequenos e porque compará-los lado a lado é o que
 * garante consistência visual entre eles.
 */

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[15px] font-semibold text-[color:var(--navy)]">{children}</h3>;
}

function Caixa({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-[color:var(--acad-border)] bg-white p-5">{children}</div>;
}

const prosa = "text-[13px] leading-relaxed text-[color:var(--acad-text)]";
const rotulo = "text-[11px] font-semibold uppercase tracking-[.14em] text-[color:var(--acad-muted)]";
const mono = "font-mono text-[12px] leading-relaxed whitespace-pre-wrap";

/** conceito e mcp — prosa com HTML embutido da fonte, sanitizado. */
function Prosa({ b }: { b: Extract<Bloco, { tipo: "conceito" | "mcp" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className={`mt-2 ${prosa}`} dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(b.conteudo) }} />
    </Caixa>
  );
}

/** comparativo — matriz de strings; a primeira linha é o cabeçalho. */
function Comparativo({ b }: { b: Extract<Bloco, { tipo: "comparativo" }> }) {
  const [cab, ...corpo] = b.linhas;
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <thead>
            <tr>{(cab ?? []).map((c, i) => <th key={i} className={`border-b border-[color:var(--acad-border)] pb-2 pr-4 ${rotulo}`}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {corpo.map((linha, i) => (
              <tr key={i}>{linha.map((c, j) => <td key={j} className={`border-b border-[color:var(--acad-border)] py-2 pr-4 ${prosa}`}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </Caixa>
  );
}

function Exemplo({ b }: { b: Extract<Bloco, { tipo: "exemplo" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <ol className="mt-3 space-y-2.5">
        {b.passos.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(0,180,216,.12)] font-mono text-[10px] text-[color:var(--cyan2)]">{i + 1}</span>
            <span>
              <span className="block text-[13px] font-medium text-[color:var(--navy)]">{p.acao}</span>
              {p.desc && <span className={`mt-0.5 block ${prosa}`}>{p.desc}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Caixa>
  );
}

function Quando({ b }: { b: Extract<Bloco, { tipo: "quando" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className={rotulo}>Usar quando</p>
          <ul className="mt-2 space-y-1.5">{b.usar.map((t, i) => <li key={i} className={prosa}>✓ {t}</li>)}</ul>
        </div>
        <div>
          <p className={rotulo}>Não usar quando</p>
          <ul className="mt-2 space-y-1.5">{b.nao_usar.map((t, i) => <li key={i} className={prosa}>✕ {t}</li>)}</ul>
        </div>
      </div>
    </Caixa>
  );
}

/** tarefa e checklist_tools — lista simples de strings. A marcação de conclusão da TAREFA
 *  não vive aqui: ela é por pessoa e mora em academy_tasks/academy_progress. */
function Lista({ b }: { b: Extract<Bloco, { tipo: "tarefa" | "checklist_tools" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <ul className="mt-3 space-y-2">
        {b.itens.map((t, i) => (
          <li key={i} className={`flex gap-2.5 ${prosa}`}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Caixa>
  );
}

function SeisElementos({ b }: { b: Extract<Bloco, { tipo: "seis_elementos" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-4">
        {b.elementos.map((e, i) => (
          <div key={i} className="border-l-2 border-[color:var(--cyan)] pl-3.5">
            <p className="text-[13px] font-semibold text-[color:var(--navy)]">
              <span className="font-mono text-[11px] text-[color:var(--acad-muted)]">{e.num}</span> {e.titulo}
            </p>
            <p className={`mt-1 ${prosa}`}>{e.pergunta}</p>
            {e.exemplo && <p className={`mt-1.5 ${mono} text-[color:var(--acad-text)]`}>{e.exemplo}</p>}
            {e.erro && <p className="mt-1.5 text-[12px] text-[color:var(--acad-muted)]">Erro comum: {e.erro}</p>}
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Template({ b }: { b: Extract<Bloco, { tipo: "template" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <dl className="mt-3 space-y-2.5">
        {b.campos.map((c, i) => (
          <div key={i}>
            <dt className={rotulo}>{c.label}</dt>
            <dd className={`mt-0.5 ${prosa} text-[color:var(--acad-muted)]`}>{c.placeholder}</dd>
          </div>
        ))}
      </dl>
    </Caixa>
  );
}

function Estrutura({ b }: { b: Extract<Bloco, { tipo: "estrutura" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-4">
        {b.secoes.map((s, i) => (
          <div key={i}>
            <p className={`${mono} font-semibold text-[color:var(--cyan2)]`}>{s.tag}</p>
            <p className={`mt-1 ${prosa}`}>{s.desc}</p>
            {s.exemplo && <pre className={`mt-2 overflow-x-auto rounded-[8px] bg-[#F0F3F7] p-3 ${mono}`}>{s.exemplo}</pre>}
            {s.dica && <p className="mt-1.5 text-[12px] text-[color:var(--acad-muted)]">Dica: {s.dica}</p>}
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function BomRuim({ b }: { b: Extract<Bloco, { tipo: "bom_ruim" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-4">
        {b.comparacoes.map((c, i) => (
          <div key={i}>
            <p className={rotulo}>{c.label}</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <p className={`rounded-[8px] border border-[color:var(--acad-border)] bg-[#F0F3F7] p-3 ${prosa}`}>✕ {c.ruim}</p>
              <p className={`rounded-[8px] border border-[color:var(--cyan)] p-3 ${prosa}`}>✓ {c.bom}</p>
            </div>
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Testes({ b }: { b: Extract<Bloco, { tipo: "testes" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-3">
        {b.testes.map((t, i) => (
          <div key={i}>
            <p className="text-[13px] font-semibold text-[color:var(--navy)]">{t.nome}</p>
            <p className={`mt-0.5 ${prosa}`}>{t.desc}</p>
            {t.exemplo && <p className={`mt-1 ${mono} text-[color:var(--acad-text)]`}>{t.exemplo}</p>}
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Anatomia({ b }: { b: Extract<Bloco, { tipo: "anatomia" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <dl className="mt-3 space-y-3">
        {b.campos.map((c, i) => (
          <div key={i}>
            <dt className={`${mono} font-semibold text-[color:var(--cyan2)]`}>{c.campo}</dt>
            <dd className={`mt-0.5 ${prosa}`}>{c.desc}</dd>
            {c.ex && <dd className={`mt-1 ${mono} text-[color:var(--acad-muted)]`}>{c.ex}</dd>}
          </div>
        ))}
      </dl>
    </Caixa>
  );
}

/**
 * Ficha da ferramenta.
 *
 * A fonte guarda a definição em JSON, mas o aluno não precisa saber ler JSON para entender
 * o que a ferramenta faz — e não deve precisar. Aqui o conteúdo vira ficha legível
 * (nome, quando usar, o que recebe) e o código fica atrás de um botão de copiar, para quem
 * vai de fato colar em algum lugar.
 *
 * Se o formato vier diferente do esperado, cai para o código puro — melhor mostrar o
 * conteúdo original do que esconder a aula.
 */
function JsonExemplo({ b }: { b: Extract<Bloco, { tipo: "json_exemplo" }> }) {
  type Campo = { type?: string; description?: string };
  let ferramenta: { name?: string; description?: string; input_schema?: { properties?: Record<string, Campo>; required?: string[] } } | null = null;
  try { ferramenta = JSON.parse(b.json); } catch { ferramenta = null; }

  const campos = Object.entries(ferramenta?.input_schema?.properties ?? {});
  const obrigatorios = new Set(ferramenta?.input_schema?.required ?? []);

  return (
    <Caixa>
      <div className="flex items-start justify-between gap-3">
        <Titulo>{b.titulo}</Titulo>
        <CopyButton text={b.json} label="Copiar" className="acad-copy shrink-0" />
      </div>

      {ferramenta?.name ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className={rotulo}>Ferramenta</p>
            <p className={`mt-0.5 ${mono} font-semibold text-[color:var(--cyan2)]`}>{ferramenta.name}</p>
          </div>
          {ferramenta.description && (
            <div>
              <p className={rotulo}>Quando o agente usa</p>
              <p className={`mt-0.5 ${prosa}`}>{ferramenta.description}</p>
            </div>
          )}
          {campos.length > 0 && (
            <div>
              <p className={rotulo}>O que ela recebe</p>
              <ul className="mt-1.5 space-y-1.5">
                {campos.map(([nome, campo]) => (
                  <li key={nome} className={prosa}>
                    <span className={`${mono} text-[color:var(--navy)]`}>{nome}</span>
                    {obrigatorios.has(nome)
                      ? <span className="ml-1.5 font-mono text-[10px] uppercase text-[color:var(--cyan2)]">obrigatório</span>
                      : <span className="ml-1.5 font-mono text-[10px] uppercase text-[color:var(--acad-muted)]">opcional</span>}
                    {campo.description && <span className="block text-[color:var(--acad-muted)]">{campo.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <pre className={`mt-3 overflow-x-auto rounded-[8px] bg-[#F0F3F7] p-4 ${mono}`}>{b.json}</pre>
      )}
    </Caixa>
  );
}

function Riscos({ b }: { b: Extract<Bloco, { tipo: "riscos" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-4">
        {b.itens.map((r, i) => (
          <div key={i} className="border-l-2 pl-3.5" style={{ borderColor: corDoNivel(r.nivel) }}>
            <p className="text-[13px] font-semibold text-[color:var(--navy)]">
              {r.risco} <span className="font-mono text-[10px]" style={{ color: corDoNivel(r.nivel) }}>{r.nivel}</span>
            </p>
            <p className={`mt-1 ${prosa}`}>{r.desc}</p>
            {r.exemplo && <p className={`mt-1.5 ${mono} text-[color:var(--acad-muted)]`}>{r.exemplo}</p>}
            {r.mitigacao && <p className={`mt-1.5 ${prosa}`}><span className={rotulo}>Mitigação </span>{r.mitigacao}</p>}
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Governanca({ b }: { b: Extract<Bloco, { tipo: "governanca" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-3">
        {b.perguntas.map((p, i) => (
          <div key={i}>
            <p className="text-[13px] font-semibold text-[color:var(--navy)]">{p.q}</p>
            <p className={`mt-0.5 ${prosa}`}>{p.desc}</p>
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Formula({ b }: { b: Extract<Bloco, { tipo: "formula" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 space-y-3">
        {b.blocos.map((f, i) => (
          <div key={i}>
            <p className={rotulo}>{f.label}</p>
            <pre className={`mt-1 overflow-x-auto rounded-[8px] bg-[#F0F3F7] p-3 ${mono}`}>{f.formula}</pre>
            {f.ex && <p className={`mt-1 ${mono} text-[color:var(--acad-muted)]`}>{f.ex}</p>}
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Ciclo({ b }: { b: Extract<Bloco, { tipo: "ciclo" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {b.etapas.map((e, i) => (
          <div key={i} className="rounded-[10px] border border-[color:var(--acad-border)] p-3.5">
            <p className="text-[13px] font-semibold text-[color:var(--navy)]">
              <span className="font-mono text-[11px] text-[color:var(--acad-muted)]">{e.num}</span> {e.titulo}
            </p>
            <p className={`mt-1 ${prosa}`}>{e.desc}</p>
            {e.freq && <p className="mt-1.5 font-mono text-[10px] uppercase text-[color:var(--cyan2)]">{e.freq}</p>}
          </div>
        ))}
      </div>
    </Caixa>
  );
}

function Apresentacao({ b }: { b: Extract<Bloco, { tipo: "apresentacao" }> }) {
  return (
    <Caixa>
      <Titulo>{b.titulo}</Titulo>
      <ol className="mt-3 space-y-2.5">
        {b.topicos.map((t, i) => (
          <li key={i}>
            <p className="text-[13px] font-semibold text-[color:var(--navy)]">{i + 1}. {t.titulo}</p>
            <p className={`mt-0.5 ${prosa}`}>{t.desc}</p>
          </li>
        ))}
      </ol>
    </Caixa>
  );
}

/**
 * Rede de segurança para um tipo sem renderizador.
 *
 * NUNCA despeja a estrutura crua na tela: o aluno não tem por que ver JSON, e um dump de
 * objeto é artefato de desenvolvedor. Mostra o texto que dá para mostrar, em ordem, e nada
 * mais. O teste de conteúdo impede que isto apareça em produção; isto é o último recurso.
 */
function BlocoDesconhecido({ b }: { b: { tipo: string; titulo?: string } }) {
  const { tipo: _tipo, titulo, ...resto } = b as Record<string, unknown> & { tipo: string; titulo?: string };
  const textos: string[] = [];
  const colher = (v: unknown) => {
    if (typeof v === "string" && v.trim()) textos.push(v.trim());
    else if (Array.isArray(v)) v.forEach(colher);
    else if (v && typeof v === "object") Object.values(v).forEach(colher);
  };
  colher(resto);
  return (
    <Caixa>
      <Titulo>{titulo ?? "Conteúdo"}</Titulo>
      {textos.length > 0
        ? <ul className="mt-2 space-y-1.5">{textos.map((t, i) => <li key={i} className={prosa}>{t}</li>)}</ul>
        : <p className={`mt-2 ${prosa} text-[color:var(--acad-muted)]`}>Este conteúdo está sendo preparado.</p>}
    </Caixa>
  );
}

/** Renderiza um bloco pelo seu tipo. */
export function BlocoAula({ b }: { b: Bloco | { tipo: string; titulo?: string } }) {
  switch (b.tipo) {
    case "conceito":
    case "mcp": return <Prosa b={b as Extract<Bloco, { tipo: "conceito" | "mcp" }>} />;
    case "comparativo": return <Comparativo b={b as Extract<Bloco, { tipo: "comparativo" }>} />;
    case "exemplo": return <Exemplo b={b as Extract<Bloco, { tipo: "exemplo" }>} />;
    case "quando": return <Quando b={b as Extract<Bloco, { tipo: "quando" }>} />;
    case "tarefa":
    case "checklist_tools": return <Lista b={b as Extract<Bloco, { tipo: "tarefa" | "checklist_tools" }>} />;
    case "seis_elementos": return <SeisElementos b={b as Extract<Bloco, { tipo: "seis_elementos" }>} />;
    case "template": return <Template b={b as Extract<Bloco, { tipo: "template" }>} />;
    case "estrutura": return <Estrutura b={b as Extract<Bloco, { tipo: "estrutura" }>} />;
    case "bom_ruim": return <BomRuim b={b as Extract<Bloco, { tipo: "bom_ruim" }>} />;
    case "testes": return <Testes b={b as Extract<Bloco, { tipo: "testes" }>} />;
    case "anatomia": return <Anatomia b={b as Extract<Bloco, { tipo: "anatomia" }>} />;
    case "json_exemplo": return <JsonExemplo b={b as Extract<Bloco, { tipo: "json_exemplo" }>} />;
    case "riscos": return <Riscos b={b as Extract<Bloco, { tipo: "riscos" }>} />;
    case "governanca": return <Governanca b={b as Extract<Bloco, { tipo: "governanca" }>} />;
    case "formula": return <Formula b={b as Extract<Bloco, { tipo: "formula" }>} />;
    case "ciclo": return <Ciclo b={b as Extract<Bloco, { tipo: "ciclo" }>} />;
    case "apresentacao": return <Apresentacao b={b as Extract<Bloco, { tipo: "apresentacao" }>} />;
    default: return <BlocoDesconhecido b={b} />;
  }
}

/** Tipos com renderizador. Usado pelo teste de cobertura da importação. */
export const TIPOS_COM_RENDERIZADOR = [
  "conceito", "mcp", "comparativo", "exemplo", "quando", "tarefa", "checklist_tools",
  "seis_elementos", "template", "estrutura", "bom_ruim", "testes", "anatomia",
  "json_exemplo", "riscos", "governanca", "formula", "ciclo", "apresentacao",
] as const;
