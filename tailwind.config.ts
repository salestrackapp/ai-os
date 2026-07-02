import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0F1A24", navy2: "#16242F", navy3: "#1D2E3C",
        gold: "#C89B3C", cream: "#F7F4EE",
        muted: "#8FA1AE", muted2: "#5E7180", teal: "#3FA98E",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderColor: { line: "rgba(247,244,238,.09)", goldline: "rgba(200,155,60,.32)" },
    },
  },
  plugins: [],
};
export default config;
