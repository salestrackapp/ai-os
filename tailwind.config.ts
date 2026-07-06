import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Legado → RE-MAPEADO para Salestrack AI v2 CLARO (PROMPT REV) ──
        // Os nomes seguem (zero quebra nas telas), mas resolvem para o v2:
        // superfícies claras, texto ink, acento violeta. Documentos escuros
        // standalone (ProposalDocument, /p, /seguranca) usam hex fixo, não estes.
        navy: "#F7F7FA", navy2: "#FFFFFF", navy3: "#F2F1F8",
        gold: "#4F1FFF", cream: "#0B0B16",
        muted: "#52515F", muted2: "#6B6B7C", teal: "#18A06B",
        // ── Design System v5 (Salestrack AI v2) ──
        brand: { DEFAULT: "#4F1FFF", light: "#7C4DFF", hover: "#3E14E0", deep: "#310CB8" },
        spark: "#EBF212",
        ink: { DEFAULT: "#0B0B16", violet: "#110C2E" },
        tile: "#EEEAFF",
        gray: {
          50: "#F7F7FA", 100: "#EFEFF4", 200: "#E4E3EE", 300: "#D2D0E0", 400: "#9B99AC",
          500: "#6B6B7C", 600: "#52515F", 700: "#3B3A46", 800: "#26252F", 900: "#12121C",
        },
        success: "#18A06B", warn: "#E8A317", danger: "#E5685F",
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
        line: "var(--border)", goldline: "rgba(79,31,255,.28)",
        hairline: "var(--border)", "hairline-strong": "var(--border-strong)",
      },
      borderRadius: { "ds-input": "12px", "ds-card": "16px", "ds-panel": "24px", "ds-pill": "999px" },
      boxShadow: {
        "ds-xs": "var(--shadow-xs)", "ds-sm": "var(--shadow-sm)", "ds-md": "var(--shadow-md)",
        "ds-lg": "var(--shadow-lg)", "ds-xl": "var(--shadow-xl)", "ds-brand": "var(--shadow-brand)",
      },
      backgroundImage: { "grad-brand": "linear-gradient(135deg,#4F1FFF,#3E5BF0)", "wash-bloom": "var(--wash-bloom)" },
    },
  },
  plugins: [],
};
export default config;
