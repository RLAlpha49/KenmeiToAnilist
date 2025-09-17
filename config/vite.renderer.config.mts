import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { readFileSync } from "fs";

// Get package version from root package.json (one level up from config directory)
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
);

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
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
        manualChunks: (id) => {
          const vendorUIFrameworkPkgs = [
            "@radix-ui",
            "@icons-pack",
            "class-variance-authority",
            "tailwind",
            "tailwindcss",
            "framer-motion",
            "sonner",
          ];
          if (
            vendorUIFrameworkPkgs.some((pkg) =>
              id.includes(`node_modules/${pkg}`),
            )
          ) {
            return "vendor-ui-framework";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
          const appChunks = [
            { match: "/components/ui/", name: "app-ui-components" },
            { match: "/components/import/", name: "app-import-components" },
            { match: "/components/matching/", name: "app-matching-components" },
            { match: "/components/sync/", name: "app-sync-components" },
            { match: "/context/", name: "app-context" },
            { match: "/helpers/", name: "app-helpers" },
            { match: "/hooks/", name: "app-hooks" },
            { match: "/pages/", name: "app-pages" },
          ];
          for (const chunk of appChunks) {
            if (id.includes(chunk.match)) {
              return chunk.name;
            }
          }
          return "app-core";
        },
      },
    },
    minify: "esbuild",
  },
});
