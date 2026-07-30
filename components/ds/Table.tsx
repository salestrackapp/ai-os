/**
 * DS v5 · Table (Salestrack AI v2)
 * Cabeçalho mono, hairlines, linha hover --bg-2, estado vazio embutido.
 * API: <Table columns={[{key,header,align?,mono?,render?}]} rows={[]} getKey empty />
 */
import { cn } from "@/lib/ds/cn";
import { EmptyState } from "./primitives";

export type Column<T> = {
  key: string; header: string; align?: "left" | "right" | "center"; mono?: boolean;
  render?: (row: T) => React.ReactNode;
};

export function Table<T extends Record<string, unknown>>({ columns, rows, getKey, empty, className }: {
  columns: Column<T>[]; rows: T[]; getKey: (row: T, i: number) => string;
  empty?: { title: string; description?: string; action?: React.ReactNode; guiaHref?: string }; className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <EmptyState title={empty.title} description={empty.description} action={empty.action} guiaHref={empty.guiaHref} />;
  }
  return (
    <div className={cn("overflow-x-auto rounded-ds-card border border-hairline bg-[var(--bg-1)] shadow-ds-xs", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-3 font-jbmono text-[13px] font-normal uppercase tracking-[0.08em] text-[color:var(--fg-3)]",
                c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getKey(row, i)} className="border-b border-hairline last:border-0 transition-colors duration-150 hover:bg-[var(--bg-2)]">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 text-sm text-[color:var(--fg-2)]",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.mono && "font-jbmono tabular-nums text-[color:var(--fg-1)]")}>
                  {c.render ? c.render(row) : String(row[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
