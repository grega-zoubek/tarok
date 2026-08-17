import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // Avoid relying on a local DNS entry for localhost when Vitest starts Vite.
    host: "127.0.0.1",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
