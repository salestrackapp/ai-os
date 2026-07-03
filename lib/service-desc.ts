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

export type ServiceParts = { lead: string; paraQuem: string; quando: string; entregas: string[] };

/** Quebra uma descrição no formato Posicionamento / Para quem / Quando / Entregas. */
export function parseServiceParts(text?: string | null): ServiceParts {
  const lead: string[] = []; let paraQuem = "", quando = ""; const entregas: string[] = [];
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("•")) { entregas.push(line.replace(/^•\s*/, "")); continue; }
    const pq = line.match(/^Para quem:\s*(.*)$/i);
    const qd = line.match(/^Quando:\s*(.*)$/i);
    if (/^Entregas[^:]*:$/i.test(line)) continue;
    if (pq) { paraQuem = pq[1]; continue; }
    if (qd) { quando = qd[1]; continue; }
    lead.push(line);
  }
  return { lead: lead.join("\n"), paraQuem, quando, entregas };
}

/** Recompõe a descrição a partir das partes estruturadas (formato canônico do catálogo). */
export function composeDescription(p: ServiceParts): string {
  const lines: string[] = [];
  if (p.lead.trim()) lines.push(p.lead.trim());
  if (p.paraQuem.trim()) lines.push(`Para quem: ${p.paraQuem.trim()}`);
  if (p.quando.trim()) lines.push(`Quando: ${p.quando.trim()}`);
  const ent = p.entregas.map((e) => e.trim()).filter(Boolean);
  if (ent.length) { lines.push(""); lines.push("Entregas:"); ent.forEach((e) => lines.push(`• ${e}`)); }
  return lines.join("\n");
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
