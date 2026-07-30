"use client";
/**
 * A prova, do ponto de vista do aluno: uma questão por bloco, resposta por clique.
 *
 * O resultado nunca aparece como dado bruto — nota, situação e o que fazer a seguir,
 * em frase. Se aprovado, o certificado sai sozinho e o link já está aqui.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { enviarProva } from "@/app/academy/prova/actions";

export type QuestaoProva = { id: string; ordem: number; enunciado: string; tipo: string; alternativas: string[] };
export type Resultado = { nota: number; aprovado: boolean; acertos: number; objetivas: number; certificado: string | null };

export function Prova({ attemptId, questoes, notaMinima }: {
  attemptId: string; questoes: QuestaoProva[]; notaMinima: number;
}) {
  const [respostas, setRespostas] = useState<Record<string, string | null>>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const respondidas = questoes.filter((q) => respostas[q.id] != null).length;
  const faltam = questoes.length - respondidas;

  function enviar() {
    setErro(null);
    iniciar(async () => {
      try { setResultado(await enviarProva(attemptId, respostas)); }
      catch (e) { setErro((e as Error).message); }
    });
  }

  if (resultado) {
    const ok = resultado.aprovado;
    return (
      <div className="acad-card p-8 text-center">
        <p className="text-[13px] font-extrabold uppercase tracking-[.12em]"
          style={{ color: ok ? "var(--green)" : "var(--amber)" }}>
          {ok ? "Aprovado" : "Ainda não foi desta vez"}
        </p>
        <p className="mt-2 text-[40px] font-black leading-none text-[color:var(--navy)]">{resultado.nota}%</p>
        <p className="mt-2 text-[14px] text-[color:var(--acad-muted)]">
          Você acertou {resultado.acertos} de {resultado.objetivas} questões. A nota mínima é {notaMinima}%.
        </p>
        {ok ? (
          <div className="mt-5">
            {resultado.certificado ? (<>
              <p className="text-[14px] text-[color:var(--acad-text)]">Seu certificado foi emitido automaticamente.</p>
              <Link href="/academy/certificados" className="acad-btn-cyan mt-3 inline-block">Ver meu certificado</Link>
            </>) : (
              <p className="text-[14px] text-[color:var(--acad-text)]">
                Falta concluir as tarefas da trilha para o certificado sair. Volte à trilha e marque as pendentes.
              </p>
            )}
          </div>
        ) : (
          <Link href="/academy/trilha" className="acad-btn-cyan mt-5 inline-block">Revisar a trilha</Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="acad-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-bold text-[color:var(--navy)]">{respondidas} de {questoes.length} respondidas</p>
          <p className="font-jbmono text-[14px] font-bold text-[color:var(--cyan2)]">
            {Math.round((respondidas / Math.max(1, questoes.length)) * 100)}%
          </p>
        </div>
        <div className="acad-progress mt-2">
          <span style={{ width: `${(respondidas / Math.max(1, questoes.length)) * 100}%` }} />
        </div>
      </div>

      {questoes.map((q, i) => {
        const opcoes = q.tipo === "vf"
          ? [{ v: "V", t: "Verdadeiro" }, { v: "F", t: "Falso" }]
          : q.alternativas.map((t, k) => ({ v: String(k), t }));
        return (
          <div key={q.id} className="acad-card p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[color:var(--acad-muted)]">Questão {i + 1}</p>
            <p className="mt-1.5 text-[15px] font-bold text-[color:var(--navy)]">{q.enunciado}</p>
            <div className="mt-3 space-y-2">
              {opcoes.map((o) => {
                const marcada = respostas[q.id] === o.v;
                return (
                  <button key={o.v} onClick={() => setRespostas((a) => ({ ...a, [q.id]: o.v }))}
                    aria-pressed={marcada}
                    className={`ds-focus flex w-full items-start gap-2.5 rounded-[10px] border p-3 text-left transition-colors ${
                      marcada ? "border-[color:var(--cyan)] bg-[rgba(0,180,216,.08)]" : "border-[color:var(--acad-border)] hover:bg-[color:var(--acad-bg)]"}`}>
                    <span className={`acad-check-box mt-0.5 ${marcada ? "is-on" : ""}`} aria-hidden>{marcada ? "✓" : ""}</span>
                    <span className="text-[14px] text-[color:var(--acad-text)]">{o.t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="acad-card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-[14px] text-[color:var(--acad-muted)]">
          {faltam > 0 ? `Faltam ${faltam} questão(ões) para enviar.` : "Tudo respondido. Pode enviar."}
        </p>
        <div className="flex items-center gap-3">
          {erro && <span className="text-[14px] text-[color:var(--red)]">{erro}</span>}
          <button onClick={enviar} disabled={pendente || faltam > 0} className="acad-btn-cyan disabled:opacity-50">
            {pendente ? "Corrigindo…" : "Enviar prova"}
          </button>
        </div>
      </div>
    </div>
  );
}
