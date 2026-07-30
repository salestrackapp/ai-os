"use client";
import { useState } from "react";

/** className sobrescreve o visual padrão — a Academy usa a variante clara sobre bloco escuro. */
export function CopyButton({ text, label = "Copiar link", className }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}
      className={className ?? "ds-focus shrink-0 rounded-ds-input bg-brand px-4 h-10 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover"}>
      {ok ? "copiado!" : label}
    </button>
  );
}
