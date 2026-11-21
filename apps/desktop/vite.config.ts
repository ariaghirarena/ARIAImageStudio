import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@aria/core": r("../../packages/core/src/index.ts"),
      "@aria/ui": r("../../packages/ui/src/index.tsx"),
      "@aria/prompt-engine": r("../../packages/prompt-engine/src/index.ts"),
      "@aria/feature-registry": r("../../packages/feature-registry/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5273,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "chrome110",
    sourcemap: false,
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
  },
});
