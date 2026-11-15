import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // AI bots (uvoženi v simulacijskih testih) morajo videti engine iz izvorne
    // kode, ne iz morebiti zastarelega dist/.
    alias: {
      "@tarok/engine": new URL("./src/index.ts", import.meta.url).pathname,
    },
  },
  server: {
    // Avoid relying on a local DNS entry for localhost when Vitest starts Vite.
    host: "127.0.0.1",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
