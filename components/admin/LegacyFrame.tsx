/**
 * Frame de hospedagem das telas herdadas — agora em superfície CLARA Salestrack AI v2
 * (PROMPT REV). As classes legadas (.card/.btn/.input…) e os tokens navy/gold/cream/serif
 * foram re-tematizados para o v2 claro; este frame só provê canvas + largura + Montserrat.
 */
export function LegacyFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] px-5 py-6 font-montserrat sm:px-8 lg:px-10"
      style={{ background: "var(--bg-2)", color: "var(--fg-1)" }}
    >
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </div>
  );
}
