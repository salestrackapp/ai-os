"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copiar prompt" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch {}
      }}
      className={done ? "btn-gold text-xs" : "btn-ghost text-xs"}
    >
      {done ? "✓ Copiado" : label}
    </button>
  );
}
