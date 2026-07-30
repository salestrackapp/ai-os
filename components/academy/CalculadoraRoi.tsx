"use client";
/**
 * Calculadora de ROI — a quinta aba da Biblioteca, como na academy antiga.
 * Recalcula a cada digitação; nada de botão "calcular".
 */
import { useState } from "react";
import { calcularRoiAgente, entradaVazia, reais, type EntradaRoi } from "@/lib/academy/roi-agente";

const CAMPOS_PROCESSO: { chave: keyof EntradaRoi; label: string; sufixo?: string }[] = [
  { chave: "horasPorTarefa", label: "Horas por tarefa (manual)" },
  { chave: "tarefasPorMes", label: "Volume de tarefas por mês" },
  { chave: "custoHora", label: "Custo/hora da pessoa", sufixo: "R$" },
  { chave: "custoErrosMes", label: "Custo de erros e retrabalho por mês", sufixo: "R$" },
];

const CAMPOS_AGENTE: { chave: keyof EntradaRoi; label: string; sufixo?: string }[] = [
  { chave: "custoDesenvolvimento", label: "Custo de desenvolvimento (único)", sufixo: "R$" },
  { chave: "custoApiMes", label: "API da IA por mês", sufixo: "R$" },
  { chave: "custoInfraMes", label: "Infraestrutura por mês", sufixo: "R$" },
  { chave: "percentualAutomatizado", label: "Tarefas automatizadas", sufixo: "%" },
];

export function CalculadoraRoi() {
  const [e, setE] = useState<EntradaRoi>(entradaVazia());
  const r = calcularRoiAgente(e);
  const set = (k: keyof EntradaRoi) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setE((a) => ({ ...a, [k]: Number.parseFloat(ev.target.value) || 0 }));

  return (
    <div className="space-y-4">
      <div className="acad-grid-2">
        <div className="acad-card p-5">
          <h3 className="text-[15px] font-extrabold text-[color:var(--navy)]">Como é hoje, sem agente</h3>
          <div className="mt-3 space-y-3">
            {CAMPOS_PROCESSO.map((c) => (
              <label key={c.chave} className="block">
                <span className="acad-lbl">{c.sufixo ? `${c.label} (${c.sufixo})` : c.label}</span>
                <input className="acad-input" type="number" min={0} inputMode="decimal" value={e[c.chave] || ""} onChange={set(c.chave)} />
              </label>
            ))}
          </div>
        </div>
        <div className="acad-card p-5">
          <h3 className="text-[15px] font-extrabold text-[color:var(--navy)]">O que o agente custa</h3>
          <div className="mt-3 space-y-3">
            {CAMPOS_AGENTE.map((c) => (
              <label key={c.chave} className="block">
                <span className="acad-lbl">{c.sufixo ? `${c.label} (${c.sufixo})` : c.label}</span>
                <input className="acad-input" type="number" min={0} max={c.chave === "percentualAutomatizado" ? 100 : undefined} inputMode="decimal" value={e[c.chave] || ""} onChange={set(c.chave)} />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="acad-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {[
          { l: "Economia por mês", v: reais(r.economiaMensal) },
          { l: "Ganho líquido/mês", v: reais(r.ganhoLiquidoMes) },
          { l: "ROI mensal", v: `${Math.round(r.roiPercentual)}%` },
          { l: "Payback", v: r.paybackMeses ? `${r.paybackMeses.toFixed(1)} meses` : "—" },
          { l: "Ganho em 12 meses", v: reais(r.ganhoAnual) },
        ].map((k) => (
          <div key={k.l} className="acad-card p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[color:var(--acad-muted)]">{k.l}</p>
            <p className="mt-1 text-[22px] font-black text-[color:var(--navy)]">{k.v}</p>
          </div>
        ))}
      </div>

      {r.economiaMensal > 0 && (
        <div className="acad-card p-5">
          <h3 className="text-[15px] font-extrabold text-[color:var(--navy)]">Mês a mês</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[440px] border-collapse text-left">
              <thead>
                <tr>
                  {["Mês", "Investido", "Economizado", "Saldo"].map((h, i) => (
                    <th key={h} className={`border-b border-[color:var(--acad-border)] pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-[color:var(--acad-muted)] ${i ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.meses.map((m) => (
                  <tr key={m.mes}>
                    <td className="border-b border-[color:var(--acad-border)] py-2 text-[13px] text-[color:var(--acad-text)]">Mês {m.mes}</td>
                    <td className="border-b border-[color:var(--acad-border)] py-2 text-right font-mono text-[12px] text-[color:var(--acad-muted)]">({reais(m.investimentoAcumulado)})</td>
                    <td className="border-b border-[color:var(--acad-border)] py-2 text-right font-mono text-[12px] text-[color:var(--acad-text)]">{reais(m.economiaAcumulada)}</td>
                    <td className="border-b border-[color:var(--acad-border)] py-2 text-right font-mono text-[12px] font-semibold" style={{ color: m.saldo >= 0 ? "var(--green)" : "var(--red)" }}>
                      {reais(m.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
