import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",        // ← happy-dom no tiene localStorage completo
    globals: true,               // ← evita importar describe/it/expect en cada test
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});