"use client";
import { useState, useMemo } from "react";
import { parseServiceParts, composeDescription } from "@/lib/service-desc";

/**
 * Editor estruturado da descrição de um serviço: Posicionamento / Para quem / Quando / Entregas.
 * Compõe o texto no formato canônico do catálogo e o grava num input hidden name="description",
 * então a server action (que lê "description") continua funcionando sem mudanças.
 */
export function ServiceContentEditor({ defaultValue }: { defaultValue?: string | null }) {
  const init = useMemo(() => parseServiceParts(defaultValue), [defaultValue]);
  const [lead, setLead] = useState(init.lead);
  const [paraQuem, setParaQuem] = useState(init.paraQuem);
  const [quando, setQuando] = useState(init.quando);
  const [entregas, setEntregas] = useState<string[]>(init.entregas.length ? init.entregas : [""]);

  const description = composeDescription({ lead, paraQuem, quando, entregas });

  const setE = (i: number, v: string) => setEntregas((xs) => xs.map((x, j) => j === i ? v : x));
  const addE = () => setEntregas((xs) => [...xs, ""]);
  const rmE = (i: number) => setEntregas((xs) => xs.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      {/* a action lê este campo */}
      <input type="hidden" name="description" value={description} />

      <div>
        <label className="label">Posicionamento (1–2 linhas)</label>
        <textarea className="input" rows={2} value={lead} onChange={(e) => setLead(e.target.value)}
          placeholder="Frase de posicionamento do serviço — o que é e o valor que entrega." />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Para quem</label>
          <input className="input" value={paraQuem} onChange={(e) => setParaQuem(e.target.value)}
            placeholder="ex.: CEOs e líderes comerciais…" />
        </div>
        <div>
          <label className="label">Quando / em que momento</label>
          <input className="input" value={quando} onChange={(e) => setQuando(e.target.value)}
            placeholder="ex.: no início da jornada de IA…" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label !mb-0">Entregas (checklist)</label>
          <button type="button" className="text-gold text-xs hover:underline" onClick={addE}>+ Entrega</button>
        </div>
        <div className="space-y-2">
          {entregas.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gold shrink-0">✓</span>
              <input className="input" value={e} onChange={(ev) => setE(i, ev.target.value)}
                placeholder="ex.: Relatório de maturidade de IA"
                onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addE(); } }} />
              <button type="button" className="text-muted2 hover:text-red-400 shrink-0" onClick={() => rmE(i)} disabled={entregas.length === 1}>×</button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted2 mt-2">Cada linha vira um item ✓ na Prévia do catálogo e no “Escopo e entregas” da proposta.</p>
      </div>
    </div>
  );
}
