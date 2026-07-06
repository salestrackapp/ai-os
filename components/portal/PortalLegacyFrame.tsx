/**
 * Frame de hospedagem das telas herdadas do portal — agora em superfície CLARA Salestrack AI v2
 * (PROMPT REV), preservando o white-label (.wl-theme, acento do tenant sobre o violeta).
 * Classes/tokens legados re-tematizados p/ v2 claro; o frame só provê canvas + largura + Montserrat.
 */
export function PortalLegacyFrame({ wl, wlStyle, children }: { wl: boolean; wlStyle: string; children: React.ReactNode }) {
  return (
    <div className={`min-h-[calc(100vh-3.5rem)] px-5 py-6 font-montserrat sm:px-8 lg:px-10${wl ? " wl-theme" : ""}`} style={{ background: "var(--bg-2)", color: "var(--fg-1)" }}>
      {wl && <style dangerouslySetInnerHTML={{ __html: wlStyle }} />}
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </div>
  );
}
