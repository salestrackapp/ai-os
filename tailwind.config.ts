import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Legado → RE-MAPEADO para a identidade da Academy (navy/ciano) ──
        // Os nomes seguem (zero quebra nas telas), mas resolvem para o v6.
        // Atenção ao nome enganoso: `navy` aqui é a SUPERFÍCIE clara, herdado do
        // tema escuro original; o navy de verdade é `ink`. Documentos standalone
        // (ProposalDocument, /p, /seguranca) usam hex fixo, não estes.
        navy: "#F7F8FA", navy2: "#FFFFFF", navy3: "#EEF1F5",
        gold: "#007A94", cream: "#1A1A2E",
        muted: "#52616F", muted2: "#6B7A8D", teal: "#10B981",
        // ── Design System v6 (identidade Salestrack AI Academy) ──
        brand: { DEFAULT: "#007A94", light: "#00B4D8", hover: "#006176", deep: "#005061" },
        spark: "#00E5FF",
        ink: { DEFAULT: "#1A1A2E", violet: "#0D1F3C" },
        tile: "#E1F4F9",
        gray: {
          50: "#F7F8FA", 100: "#EEF1F5", 200: "#E3E8EF", 300: "#CBD4E0", 400: "#93A1B3",
          500: "#6B7A8D", 600: "#52616F", 700: "#3B4753", 800: "#26303A", 900: "#141C24",
        },
        success: "#10B981", warn: "#F59E0B", danger: "#EF4444",
        // Semânticos (CSS-var-backed)
        fg1: "var(--fg-1)", fg2: "var(--fg-2)", fg3: "var(--fg-3)", fg4: "var(--fg-4)",
        bg1: "var(--bg-1)", bg2: "var(--bg-2)",
      },
      fontFamily: {
        // Legado → Montserrat/JetBrains (v2). Nomes mantidos p/ zero quebra.
        serif: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "ui-monospace", "monospace"],
        // DS v5
        montserrat: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        jbmono: ["JetBrains Mono", "Menlo", "ui-monospace", "SF Mono", "monospace"],
      },
      borderColor: {
        // Legado → hairline v2 (claro). line=hairline neutro, goldline=violeta sutil.
        line: "var(--border)", goldline: "rgba(0,180,216,.32)",
        hairline: "var(--border)", "hairline-strong": "var(--border-strong)",
      },
      /**
       * Régua de tipo alinhada com a da Academy (.acad-h1 = 28px, corpo 14-15, rótulo 11).
       * O padrão do Tailwind (sm=14, 2xl=24, 3xl=30, 4xl=36) é uma escala de site, grande
       * demais para um painel denso — e convivia com os tamanhos px arbitrários das telas,
       * então o sistema tinha duas réguas discordando. Aqui elas passam a bater.
       */
      fontSize: {
        xs: ["11px", { lineHeight: "1.45" }],
        sm: ["13px", { lineHeight: "1.55" }],
        base: ["14px", { lineHeight: "1.6" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["18px", { lineHeight: "1.4" }],
        "2xl": ["22px", { lineHeight: "1.3" }],
        "3xl": ["26px", { lineHeight: "1.2" }],
        "4xl": ["28px", { lineHeight: "1.15" }],
        "5xl": ["34px", { lineHeight: "1.1" }],
        "6xl": ["42px", { lineHeight: "1.05" }],
      },
      borderRadius: { "ds-input": "12px", "ds-card": "16px", "ds-panel": "24px", "ds-pill": "999px" },
      boxShadow: {
        "ds-xs": "var(--shadow-xs)", "ds-sm": "var(--shadow-sm)", "ds-md": "var(--shadow-md)",
        "ds-lg": "var(--shadow-lg)", "ds-xl": "var(--shadow-xl)", "ds-brand": "var(--shadow-brand)",
      },
      backgroundImage: { "grad-brand": "linear-gradient(135deg,#1A1A2E,#0D1F3C)", "wash-bloom": "var(--wash-bloom)" },
    },
  },
  plugins: [],
};
export default config;
