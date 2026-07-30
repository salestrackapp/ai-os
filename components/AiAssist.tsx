"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icons";

type Action = { label: string; task: string };

/**
 * Copiloto reutilizável (admin). Recebe o contexto da entidade e um conjunto de ações.
 * Clicar numa ação chama /api/admin/copilot e mostra o resultado com "copiar".
 * Basta plugar <AiAssist context={...} actions={[...]} /> em qualquer tela admin.
 */
export function AiAssist({ context, actions, title = "Copiloto", compact = false }: { context: string; actions: Action[]; title?: string; compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<string>("");
  const [copied, setCopied] = useState(false);

  async function run(a: Action) {
    setBusy(a.label); setOut(""); setCopied(false);
    try {
      const res = await fetch("/api/admin/copilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: a.task, context }) });
      const d = await res.json();
      setOut(d.text ?? d.error ?? "Sem resposta.");
    } catch { setOut("Falha de conexão."); }
    finally { setBusy(null); }
  }

  return (
    <div className={compact ? "" : "card p-5 border-goldline bg-[rgba(0, 122, 148,.04)]"}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gold"><Icon name="sparkles" size={16} /></span><p className="label !mb-0">{title}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.label} onClick={() => run(a)} disabled={!!busy}
            className="btn-ghost text-xs disabled:opacity-50">{busy === a.label ? "Gerando…" : a.label}</button>
        ))}
      </div>
      {out && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-muted2">Resultado</span>
            <button onClick={async () => { try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} className="text-[13px] text-muted2 hover:text-gold">{copied ? "✓ copiado" : "copiar"}</button>
          </div>
          <div className="bg-navy3 border border-line rounded-lg p-3 text-sm text-cream whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{out}</div>
        </div>
      )}
    </div>
  );
}
