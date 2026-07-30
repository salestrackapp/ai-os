"use client";
/**
 * Biblioteca de Recursos — as cinco abas da academy antiga, com as mesmas telas.
 *
 * Cada aba tem forma própria de propósito, como no original: prompt é cartão com cabeçalho escuro
 * que abre em modal; ferramenta é ficha técnica; checklist é lista marcável com barra de progresso;
 * glossário é cartão com faixa colorida por categoria. Uma lista genérica para os quatro perderia
 * exatamente o que distingue cada um.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { CalculadoraRoi } from "./CalculadoraRoi";
import { salvarEstadoFerramenta } from "@/app/academy/biblioteca/actions";

export type RefItem = {
  id: string; tipo: string; nome: string; categoria: string | null;
  icone: string | null; cor: string | null; conteudo: string | null;
  impacto: string | null; ferramentas: string | null; sistema: string | null;
  parametros: string | null; retorno: string | null; termo_en: string | null;
  exemplo: string | null; risco: string | null;
};

const ABAS = [
  { tipo: "prompt", label: "Prompts prontos", vazio: "Nenhum prompt nesta busca." },
  { tipo: "ferramenta", label: "Ferramentas", vazio: "Nenhuma ferramenta nesta busca." },
  { tipo: "checklist", label: "Checklist de segurança", vazio: "Nenhum item nesta busca." },
  { tipo: "termo", label: "Glossário", vazio: "Nenhum termo nesta busca." },
  { tipo: "roi", label: "Calculadora de ROI", vazio: "" },
] as const;

// Cores por categoria do glossário, como no original — a faixa lateral é o que dá a leitura rápida.
const CORES_CAT = ["var(--cyan)", "var(--purple)", "var(--green)", "var(--amber)", "var(--red)"];
const corDaCategoria = (cats: string[], c: string | null) =>
  CORES_CAT[Math.max(0, cats.indexOf(c ?? "")) % CORES_CAT.length];

const rotulo = "acad-pc-label";
const prosa = "text-[13px] leading-relaxed text-[color:var(--acad-text)]";

function badgeRisco(r: string | null) {
  if (!r) return null;
  const cls = r === "alto" ? "acad-badge-red" : r === "medio" ? "acad-badge-amber" : "acad-badge-green";
  return <span className={`acad-badge ${cls} capitalize`}>risco {r}</span>;
}

/** Modal do original: cabeçalho com nome, corpo rolável, rodapé com as ações. */
function Modal({ titulo, subtitulo, onFechar, children, rodape }: {
  titulo: string; subtitulo?: string | null; onFechar: () => void;
  children: React.ReactNode; rodape?: React.ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = antes; };
  }, [onFechar]);

  return (
    <div className="acad-modal" role="dialog" aria-modal="true" aria-label={titulo}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="acad-modal-box">
        <div className="acad-modal-head">
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold text-[color:var(--navy)]">{titulo}</p>
            {subtitulo && <p className="mt-0.5 text-[12px] text-[color:var(--acad-muted)]">{subtitulo}</p>}
          </div>
          <button onClick={onFechar} aria-label="Fechar"
            className="ds-focus shrink-0 rounded-lg px-2 py-1 text-[20px] leading-none text-[color:var(--acad-muted)] hover:bg-[color:var(--acad-bg)]">×</button>
        </div>
        <div className="acad-modal-body">{children}</div>
        {rodape && <div className="acad-modal-foot">{rodape}</div>}
      </div>
    </div>
  );
}

/** Checklist de segurança — marcável, agrupado por categoria, com progresso salvo na conta. */
function Checklist({ itens, marcadoInicial }: { itens: RefItem[]; marcadoInicial: Record<string, boolean> }) {
  const [marcado, setMarcado] = useState<Record<string, boolean>>(marcadoInicial);
  const [, iniciar] = useTransition();

  const grupos = useMemo(() => {
    const m = new Map<string, RefItem[]>();
    for (const i of itens) {
      const c = i.categoria ?? "Geral";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(i);
    }
    return [...m.entries()];
  }, [itens]);

  const feitos = itens.filter((i) => marcado[i.id]).length;
  const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;

  const alternar = (id: string) => {
    const novo = { ...marcado, [id]: !marcado[id] };
    setMarcado(novo);
    iniciar(() => { void salvarEstadoFerramenta("checklist_seguranca", novo); });
  };

  return (
    <div className="space-y-4">
      <div className="acad-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-bold text-[color:var(--navy)]">{feitos} de {itens.length} itens verificados</p>
          <p className="font-jbmono text-[13px] font-bold text-[color:var(--cyan2)]">{pct}%</p>
        </div>
        <div className="acad-progress mt-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {grupos.map(([cat, lista]) => (
        <div key={cat}>
          <p className="acad-check-cat">{cat}</p>
          {lista.map((i) => {
            const on = !!marcado[i.id];
            return (
              <button key={i.id} onClick={() => alternar(i.id)} className="acad-check-item ds-focus"
                aria-pressed={on}>
                <span className={`acad-check-box ${on ? "is-on" : ""}`} aria-hidden>{on ? "✓" : ""}</span>
                <span className="min-w-0 flex-1">
                  <span className={`acad-check-text block ${on ? "is-done" : ""}`}>{i.nome}</span>
                  {i.conteudo && <span className="acad-check-detail block">{i.conteudo}</span>}
                </span>
                {badgeRisco(i.risco)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Referencias({ itens, abaInicial, checklistMarcado = {} }: {
  itens: RefItem[]; abaInicial?: string; checklistMarcado?: Record<string, boolean>;
}) {
  const [aba, setAba] = useState<string>(ABAS.some((a) => a.tipo === abaInicial) ? abaInicial! : "prompt");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [aberto, setAberto] = useState<RefItem | null>(null);

  const daAba = useMemo(() => itens.filter((i) => i.tipo === aba), [itens, aba]);
  const categorias = useMemo(
    () => ["Todas", ...([...new Set(daAba.map((i) => i.categoria).filter(Boolean))].sort() as string[])],
    [daAba],
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return daAba.filter((i) => {
      if (categoria !== "Todas" && i.categoria !== categoria) return false;
      if (!q) return true;
      return [i.nome, i.categoria, i.conteudo, i.termo_en, i.sistema].some((c) => c?.toLowerCase().includes(q));
    });
  }, [daAba, busca, categoria]);

  const abaAtual = ABAS.find((a) => a.tipo === aba)!;
  const catsGloss = useMemo(
    () => [...new Set(itens.filter((i) => i.tipo === "termo").map((i) => i.categoria ?? ""))].sort(),
    [itens],
  );

  return (
    <div>
      <div className="acad-tabs mb-4">
        {ABAS.map((a) => {
          const n = a.tipo === "roi" ? null : itens.filter((i) => i.tipo === a.tipo).length;
          return (
            <button key={a.tipo} onClick={() => { setAba(a.tipo); setCategoria("Todas"); setBusca(""); setAberto(null); }}
              className={`acad-tab ${aba === a.tipo ? "is-active" : ""}`}>
              {a.label}{n !== null && <span className="ml-1 font-jbmono text-[11px]">{n}</span>}
            </button>
          );
        })}
      </div>

      {aba === "roi" ? <CalculadoraRoi /> : (<>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input className="acad-input max-w-xs" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar…" aria-label="Buscar nas referências" />
          {categorias.length > 2 && (
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <button key={c} onClick={() => setCategoria(c)} className={`acad-chip ${categoria === c ? "is-on" : ""}`}>{c}</button>
              ))}
            </div>
          )}
        </div>

        {visiveis.length === 0 ? (
          <div className="acad-card p-8 text-center">
            <p className="text-[14px] font-bold text-[color:var(--navy)]">{abaAtual.vazio}</p>
            <p className="mt-1 text-[13px] text-[color:var(--acad-muted)]">Ajuste a busca ou o filtro de categoria.</p>
          </div>
        ) : aba === "checklist" ? (
          <Checklist itens={visiveis} marcadoInicial={checklistMarcado} />
        ) : aba === "termo" ? (
          <div className="acad-grid-lg">
            {visiveis.map((i) => (
              <div key={i.id} className="acad-gloss" style={{ borderLeftColor: corDaCategoria(catsGloss, i.categoria) }}>
                <p className="acad-gc-term">{i.nome}</p>
                {i.termo_en && <p className="acad-gc-en">{i.termo_en}</p>}
                {i.conteudo && <p className="acad-gc-def">{i.conteudo}</p>}
                {i.exemplo && <p className="acad-gc-ex"><strong>Exemplo: </strong>{i.exemplo}</p>}
              </div>
            ))}
          </div>
        ) : aba === "prompt" ? (
          <div className="acad-grid-lg">
            {visiveis.map((i) => (
              <div key={i.id} className="acad-prompt-card">
                <div className="acad-pc-header">
                  <span className="acad-pc-icon" aria-hidden>{i.icone ?? "🖊️"}</span>
                  <div className="min-w-0">
                    <p className="acad-pc-area" style={{ color: "var(--cyan)" }}>{i.categoria}</p>
                    <p className="acad-pc-name">{i.nome}</p>
                    {i.impacto && <span className="acad-pc-impact">{i.impacto}</span>}
                  </div>
                </div>
                <div className="acad-pc-body">
                  {i.ferramentas && (<>
                    <p className={rotulo}>Ferramentas necessárias</p>
                    <div className="acad-tool-chips">
                      {i.ferramentas.split("\n").filter(Boolean).map((f, k) => <span key={k} className="acad-tool-chip">{f}</span>)}
                    </div>
                  </>)}
                </div>
                <div className="acad-pc-footer">
                  <button onClick={() => setAberto(i)} className="acad-btn-copy">Ver prompt completo</button>
                  {i.conteudo && <CopyButton text={i.conteudo} label="Copiar" className="acad-copy" />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="acad-grid-lg">
            {visiveis.map((i) => (
              <button key={i.id} onClick={() => setAberto(i)} className="acad-card ds-focus p-4 text-left">
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className="text-[18px] leading-none">{i.icone ?? "🔧"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-jbmono text-[14px] font-bold text-[color:var(--navy)]">{i.nome}</p>
                    <p className="mt-0.5 text-[11px] text-[color:var(--acad-muted)]">
                      {i.categoria}{i.sistema ? ` · ${i.sistema}` : ""}
                    </p>
                    {i.conteudo && <p className="mt-2 line-clamp-2 text-[13px] text-[color:var(--acad-text)]">{i.conteudo}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </>)}

      {aberto && (
        <Modal titulo={aberto.nome}
          subtitulo={[aberto.categoria, aberto.sistema].filter(Boolean).join(" · ") || null}
          onFechar={() => setAberto(null)}
          rodape={aberto.conteudo && aberto.tipo === "prompt"
            ? <CopyButton text={aberto.conteudo} label="Copiar system prompt" className="acad-btn-copy" />
            : undefined}>
          {aberto.tipo === "prompt" ? (<>
            {aberto.ferramentas && (<>
              <p className={rotulo}>Ferramentas necessárias</p>
              <div className="acad-tool-chips mb-4">
                {aberto.ferramentas.split("\n").filter(Boolean).map((f, k) => <span key={k} className="acad-tool-chip">{f}</span>)}
              </div>
            </>)}
            <p className={rotulo}>System prompt</p>
            <div className="acad-code-block">
              <div className="acad-code-header"><span className="acad-code-lang">system prompt</span></div>
              <pre className="acad-code-content">{aberto.conteudo}</pre>
            </div>
          </>) : (<>
            {aberto.conteudo && <div className="mb-4"><p className={rotulo}>Para que serve</p><p className={prosa}>{aberto.conteudo}</p></div>}
            {aberto.parametros && <div className="mb-4"><p className={rotulo}>O que ela recebe</p><p className={prosa}>{aberto.parametros}</p></div>}
            {aberto.retorno && <div className="mb-4"><p className={rotulo}>O que ela devolve</p><p className={prosa}>{aberto.retorno}</p></div>}
            {aberto.exemplo && <div><p className={rotulo}>Exemplo</p><p className={prosa}>{aberto.exemplo}</p></div>}
          </>)}
        </Modal>
      )}
    </div>
  );
}
