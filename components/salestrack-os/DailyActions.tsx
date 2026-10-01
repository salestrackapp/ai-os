"use client";
import { useState } from "react";
import {
  generateDailyPlan,
  generateBriefing,
} from "@/app/admin/central/actions";
export function DailyActions({
  initialBriefing = "",
}: {
  initialBriefing?: string;
}) {
  const [busy, setBusy] = useState(false),
    [text, setText] = useState(initialBriefing),
    [msg, setMsg] = useState("");
  async function run(ai: boolean) {
    setBusy(true);
    setMsg("");
    try {
      if (ai) {
        const r = await generateBriefing();
        setText(r.text);
        setMsg(`Rascunho gerado · ${r.model} · ${r.tokens} tokens`);
      } else {
        const r = await generateDailyPlan();
        setMsg(
          `Plano de ${r.day} preservado no histórico. Nenhum envio realizado.`,
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao executar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card mb-6 p-5">
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => run(false)} className="btn-gold">
          Salvar plano do dia
        </button>
        <button
          disabled={busy}
          onClick={() => run(true)}
          className="btn-outline"
        >
          Gerar briefing com IA
        </button>
      </div>
      <p role="status" className="mt-3 text-sm">
        {msg}
      </p>
      {text && (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            Sugestão da IA · revise antes de agir
          </p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">
            {text}
          </pre>
        </div>
      )}
    </section>
  );
}
