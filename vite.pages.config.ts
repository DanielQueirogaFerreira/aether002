import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/aether002/",
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  publicDir: "public",
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./pages.html", import.meta.url)),
    },
  },
});
