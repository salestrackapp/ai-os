"use client";
import { useState } from "react";
import { FRENTE_SUGGESTIONS } from "@/lib/types";

export function FrentesInput({ defaultValue = [] }: { defaultValue?: string[] }) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [input, setInput] = useState("");

  function add(t: string) {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setInput("");
  }
  function remove(t: string) { setTags(tags.filter((x) => x !== t)); }

  return (
    <div>
      {/* hidden inputs => FormData.getAll("frentes") */}
      {tags.map((t) => <input key={t} type="hidden" name="frentes" value={t} />)}
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t) => (
          <span key={t} className="badge-teal inline-flex items-center gap-1.5">
            {t}<button type="button" onClick={() => remove(t)} className="hover:text-cream">×</button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted2">Nenhuma frente</span>}
      </div>
      <input className="input" value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
        placeholder="Digite e Enter, ou clique numa sugestão" list="frente-sugestoes" />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {FRENTE_SUGGESTIONS.filter((s) => !tags.includes(s)).map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className="badge-muted hover:!text-gold hover:!border-goldline">+ {s}</button>
        ))}
      </div>
    </div>
  );
}
