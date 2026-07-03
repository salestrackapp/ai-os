// Utilitários puros para descrições de serviço (Para quem / Quando / Entregas: •checklist)

export type DescBlock =
  | { type: "label"; label: string; rest: string }
  | { type: "p"; text: string }
  | { type: "bullets"; items: string[] };

/** Retorna só as entregas (linhas com "•"). */
export function deliverablesOf(text?: string | null): string[] {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("•")).map((l) => l.replace(/^•\s*/, ""));
}

/** Estrutura a descrição em blocos para render (rótulos, parágrafos, listas). */
export function parseDescription(text?: string | null): DescBlock[] {
  const blocks: DescBlock[] = [];
  let bullets: string[] = [];
  const flush = () => { if (bullets.length) { blocks.push({ type: "bullets", items: bullets }); bullets = []; } };
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("•")) { bullets.push(line.replace(/^•\s*/, "")); continue; }
    flush();
    const m = line.match(/^(Para quem|Quando|Entregas[^:]*):\s*(.*)$/i);
    if (m) blocks.push({ type: "label", label: m[1], rest: m[2] });
    else blocks.push({ type: "p", text: line });
  }
  flush();
  return blocks;
}
