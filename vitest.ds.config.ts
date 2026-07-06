import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Config separada para testes de componente (jsdom + React). O gate de RLS usa vitest.config.ts (node).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "."), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/ds.setup.ts"],
    include: ["components/ds/__tests__/**/*.test.tsx"],
  },
});
