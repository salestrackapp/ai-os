import { parseDescription } from "@/lib/service-desc";

/** Render bonito de uma descrição de serviço (rótulos + checklist de entregas). Componente puro. */
export function ServiceDescription({ text }: { text?: string | null }) {
  const blocks = parseDescription(text);
  if (blocks.length === 0) return <p className="text-sm text-muted2">Sem descrição.</p>;
  return (
    <div className="space-y-2 text-sm">
      {blocks.map((b, i) => {
        if (b.type === "bullets")
          return (
            <ul key={i} className="space-y-1 pt-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 text-muted"><span className="text-gold shrink-0">✓</span><span>{it}</span></li>
              ))}
            </ul>
          );
        if (b.type === "label")
          return <p key={i} className="text-muted"><span className="text-gold font-medium">{b.label}:</span> {b.rest}</p>;
        return <p key={i} className="text-cream">{b.text}</p>;
      })}
    </div>
  );
}
