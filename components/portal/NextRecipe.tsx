"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";

/** Card proativo: o Consultor recomenda a próxima Receita do Playbook para o cliente. */
export function NextRecipe() {
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<{ slug?: string; titulo?: string; why?: string; text?: string } | null>(null);

  async function ask() {
    setBusy(true); setRec(null);
    try {
      const res = await fetch("/api/portal/recommend-recipe", { method: "POST" });
      setRec(await res.json());
    } catch { setRec({ text: "Não consegui recomendar agora." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="card p-5 border-goldline bg-[rgba(79, 31, 255,.06)]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-gold"><Icon name="sparkles" size={16} /></span>
          <p className="font-serif text-lg font-semibold">Por onde começar hoje?</p>
        </div>
        <button onClick={ask} disabled={busy} className="btn-gold text-sm disabled:opacity-50">{busy ? "Pensando…" : "Pedir recomendação ao Consultor"}</button>
      </div>
      {rec && (
        <div className="mt-3">
          {rec.slug ? (
            <div className="bg-navy3 border border-line rounded-lg p-4">
              <Link href={`/portal/playbook/${rec.slug}`} className="font-serif text-lg font-semibold text-cream hover:text-gold">{rec.titulo} →</Link>
              {rec.why && <p className="text-sm text-muted mt-1 leading-relaxed">{rec.why}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">{rec.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
