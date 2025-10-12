import { defineConfig } from "vite";
import path from "node:path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
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
