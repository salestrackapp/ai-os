import "server-only";
import type { RenderInput } from "../types";
import { brandSignature } from "../types";

const NAVY = "0F1A24", GOLD = "C89B3C", MUTED = "5E7180";

/** DeliverableContent → DOCX executivo (lib `docx`). Retorna Buffer .docx. */
export async function htmlToDocx(input: RenderInput): Promise<Buffer> {
  const d: any = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = d;
  const sig = brandSignature(input.brand_scope, input.branding);
  const c = input.content;
  const cover = c.cover ?? { title: input.title };
  const gold = input.brand_scope === "tenant" && input.branding?.color_accent ? input.branding.color_accent.replace("#", "") : GOLD;

  const kids: any[] = [];
  kids.push(new Paragraph({ children: [new TextRun({ text: (cover.eyebrow ?? sig.eyebrow).toUpperCase(), color: gold, bold: true, size: 18, characterSpacing: 40 })] }));
  kids.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: cover.title ?? input.title, color: NAVY, size: 56, font: "Georgia" })] }));
  if (cover.subtitle) kids.push(new Paragraph({ children: [new TextRun({ text: cover.subtitle, color: MUTED, size: 26 })] }));
  if (cover.meta?.length) kids.push(new Paragraph({ children: [new TextRun({ text: cover.meta.join("   ·   "), color: MUTED, size: 18 })] }));

  if (c.summary) {
    kids.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: "SUMÁRIO EXECUTIVO", color: gold, bold: true, size: 20, characterSpacing: 30 })] }));
    for (const para of c.summary.split(/\n{2,}/)) kids.push(new Paragraph({ children: [new TextRun({ text: para, size: 22 })] }));
  }

  for (const sec of c.sections ?? []) {
    if (sec.eyebrow) kids.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: sec.eyebrow.toUpperCase(), color: gold, bold: true, size: 18, characterSpacing: 30 })] }));
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: sec.title, color: NAVY, size: 32, font: "Georgia" })] }));
    if (sec.body) for (const para of sec.body.split(/\n{2,}/)) kids.push(new Paragraph({ children: [new TextRun({ text: para, size: 22 })] }));
    if (sec.kpis?.length) for (const k of sec.kpis) kids.push(new Paragraph({ children: [new TextRun({ text: `${k.label}: `, bold: true, size: 22 }), new TextRun({ text: k.value, color: gold, bold: true, size: 22 }), ...(k.hint ? [new TextRun({ text: `  (${k.hint})`, color: MUTED, size: 18 })] : [])] }));
    if (sec.bullets?.length) for (const b of sec.bullets) kids.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b, size: 22 })] }));
    if (sec.table) {
      const rows = [
        new TableRow({ children: sec.table.head.map((h: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: gold, size: 18 })] })] })) }),
        ...sec.table.rows.map((r: string[]) => new TableRow({ children: r.map((cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18 })] })] })) })),
      ];
      kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
    }
  }
  kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: (c.footer ?? sig.footer).toUpperCase(), color: gold, size: 16, characterSpacing: 40 })] }));

  const doc = new Document({ sections: [{ children: kids }] });
  return (await Packer.toBuffer(doc)) as Buffer;
}
