import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@aria/core": r("./packages/core/src/index.ts"),
      "@aria/ui": r("./packages/ui/src/index.tsx"),
      "@aria/prompt-engine": r("./packages/prompt-engine/src/index.ts"),
      "@aria/feature-registry": r("./packages/feature-registry/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
