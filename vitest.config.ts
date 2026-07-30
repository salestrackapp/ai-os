import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", testTimeout: 60_000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // libs de servidor importam "server-only", que lança fora do contexto RSC.
      // Mesmo stub já usado pela config do design system.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
