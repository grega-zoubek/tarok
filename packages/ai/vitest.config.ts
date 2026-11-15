import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@tarok/engine": new URL("../engine/src/index.ts", import.meta.url).pathname,
    },
  },
  server: {
    host: "127.0.0.1",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
