import { defineConfig } from "vite";
import path from "node:path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production",
    ),
    "process.env.SENTRY_DSN": JSON.stringify(process.env.SENTRY_DSN || ""),
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "src/assets/splash.html",
          dest: "assets",
        },
        {
          src: "src/assets/k2a-icon-128x128.png",
          dest: "assets",
        },
      ],
    }),
  ],
});
