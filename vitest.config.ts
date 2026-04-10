import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": new URL("./shared", import.meta.url).pathname,
      "@": new URL("./client/src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});

