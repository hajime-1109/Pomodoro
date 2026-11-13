import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss()],
  resolve: {
    // The reused UI sources live in ../client, outside this package.
    // Resolve their framework imports from standalone's node_modules.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
    alias: [
      {
        find: /^@hatch\/space-sdk\/client$/,
        replacement: path.join(here, "src", "space-sdk-client.tsx"),
      },
      // The reused theme.css lives outside this package, so its CSS
      // package imports must resolve against standalone's node_modules.
      {
        find: /^tailwindcss$/,
        replacement: path.join(
          here,
          "node_modules",
          "tailwindcss",
          "index.css",
        ),
      },
      {
        find: /^tailwindcss-safe-area$/,
        replacement: path.join(
          here,
          "node_modules",
          "tailwindcss-safe-area",
          "index.css",
        ),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      "/actions": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(here, "dist"),
    emptyOutDir: true,
  },
});
