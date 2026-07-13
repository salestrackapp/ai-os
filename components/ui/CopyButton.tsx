"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}
      className="ds-focus shrink-0 rounded-ds-input bg-brand px-4 h-10 font-montserrat text-sm font-semibold text-white shadow-ds-brand hover:bg-brand-hover">
      {ok ? "copiado!" : label}
    </button>
  );
}
