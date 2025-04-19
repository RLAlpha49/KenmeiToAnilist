import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    dir: "./src/tests/unit",
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/unit/setup.ts",
    css: true,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.vite/**",
        "**/src/tests/**",
        "**/src/main/**",
        "**/src/components/ui/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mocks/**",
        "**/fixtures/**",
        "**/src/types/**",
        "**/types.ts",
        "**/src/config/**",
        "**/src/pages/**",
        "**/@check-coverage.mjs",
        "**/playwright-report/**",
      ],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
