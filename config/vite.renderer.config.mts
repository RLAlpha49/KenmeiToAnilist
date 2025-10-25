import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { visualizer } from "rollup-plugin-visualizer";

// Get package version from root package.json (one level up from config directory)
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
);

/**
 * Normalizes file paths for consistent matching across platforms.
 * Converts backslashes (Windows) to forward slashes for reliable string matching.
 * @param id - The file path to normalize
 * @returns Normalized path with forward slashes
 */
function normalizePath(id: string): string {
  return id.split("\\").join("/");
}

export default defineConfig(() => ({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    process.env.ANALYZE === "true"
      ? visualizer({
          filename: "./.vite/bundle-analysis.html",
          open: false,
          gzipSize: true,
          brotliSize: true,
          template: "treemap",
        })
      : null,
  ].filter(Boolean),
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
  },
  build: {
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Chunk strategy:
        // - vendor-react: React core (~150KB) - cached separately
        // - vendor-radix: Radix UI primitives (~200KB) - UI framework
        // - vendor-recharts: Charts library (~150KB) - lazy loaded with StatisticsPage
        // - vendor-ui-framework: Animations, icons, utilities (~200KB)
        // - vendor-data: Data processing libraries (~150KB)
        // - vendor-sentry: Error tracking (~50KB) - loaded separately for monitoring
        // - vendor-tanstack: TanStack Router (~50KB)
        // - vendor: Other dependencies (~100KB)
        // - app-*: Feature-specific application code
        manualChunks: (id) => {
          // Normalize path separators to forward slashes for consistent matching across OS
          const normalizedId = normalizePath(id);

          // React core - separate chunk for better caching
          if (
            normalizedId.includes("node_modules/react/") ||
            normalizedId.includes("node_modules/react-dom/")
          ) {
            return "vendor-react";
          }

          // Radix UI - large UI framework
          if (normalizedId.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          // Charts library - only loaded with StatisticsPage
          if (normalizedId.includes("node_modules/recharts/")) {
            return "vendor-recharts";
          }

          // Sentry error tracking - separate for monitoring
          if (
            normalizedId.includes("node_modules/@sentry/") ||
            normalizedId.includes("node_modules/@sentry-internal/")
          ) {
            return "vendor-sentry";
          }

          // Animation and UI utilities
          const uiFrameworkPkgs = [
            "framer-motion",
            "sonner",
            "lucide-react",
            "class-variance-authority",
            "tailwind-merge",
            "clsx",
          ];
          if (
            uiFrameworkPkgs.some((pkg) =>
              normalizedId.includes(`node_modules/${pkg}`),
            )
          ) {
            return "vendor-ui-framework";
          }

          // Data processing libraries
          const dataLibs = [
            "papaparse",
            "natural",
            "string-similarity",
            "fastest-levenshtein",
            "exceljs",
          ];
          if (
            dataLibs.some((pkg) => normalizedId.includes(`node_modules/${pkg}`))
          ) {
            return "vendor-data";
          }

          // TanStack Router
          if (normalizedId.includes("node_modules/@tanstack/")) {
            return "vendor-tanstack";
          }

          // Other vendor code
          if (normalizedId.includes("node_modules")) {
            return "vendor";
          }

          // App chunks by feature
          const appChunks = [
            { match: "/components/ui/", name: "app-ui-components" },
            { match: "/components/debug/", name: "app-debug" }, // Lazy loaded
            { match: "/components/import/", name: "app-import" },
            { match: "/components/matching/", name: "app-matching" },
            { match: "/components/sync/", name: "app-sync" },
            { match: "/components/statistics/", name: "app-statistics" }, // Lazy loaded with StatisticsPage
            { match: "/contexts/", name: "app-context" },
            { match: "/helpers/", name: "app-helpers" },
            { match: "/hooks/", name: "app-hooks" },
            { match: "/pages/", name: "app-pages" },
          ];

          for (const chunk of appChunks) {
            if (normalizedId.includes(chunk.match)) {
              return chunk.name;
            }
          }

          return "app-core";
        },
      },
    },
    minify: "esbuild",
  },
}));
