import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { readFileSync } from "fs";

// Get package version from package.json
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
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
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Define environment variables that will be available to the client
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
  },
  build: {
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // UI framework
          if (
            id.includes("node_modules/@radix-ui") ||
            id.includes("node_modules/@icons-pack") ||
            id.includes("node_modules/class-variance-authority") ||
            id.includes("node_modules/tailwind") ||
            id.includes("node_modules/tailwindcss") ||
            id.includes("node_modules/framer-motion") ||
            id.includes("node_modules/sonner")
          ) {
            return "vendor-ui-framework";
          }

          // Other node modules
          if (id.includes("node_modules")) {
            return "vendor";
          }

          // UI components
          if (id.includes("/components/ui/")) {
            return "app-ui-components";
          }

          // Import components
          if (id.includes("/components/import/")) {
            return "app-import-components";
          }

          // Matching components
          if (id.includes("/components/matching/")) {
            return "app-matching-components";
          }

          // Sync components
          if (id.includes("/components/sync/")) {
            return "app-sync-components";
          }

          // Context
          if (id.includes("/context/")) {
            return "app-context";
          }

          // Helpers
          if (id.includes("/helpers/")) {
            return "app-helpers";
          }

          // Hooks
          if (id.includes("/hooks/")) {
            return "app-hooks";
          }

          // Pages
          if (id.includes("/pages/")) {
            return "app-pages";
          }

          // Application core
          return "app-core";
        },
      },
    },
    minify: "esbuild",
  },
});
