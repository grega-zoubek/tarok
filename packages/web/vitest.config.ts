import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Testi naj vidijo engine in AI iz izvorne kode, ne iz morebiti
    // zastarelega dist/ (enako kot v engine in ai paketih).
    alias: {
      "@tarok/engine": new URL("../engine/src/index.ts", import.meta.url).pathname,
      "@tarok/ai": new URL("../ai/src/index.ts", import.meta.url).pathname,
    },
  },
  server: {
    host: "127.0.0.1",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
