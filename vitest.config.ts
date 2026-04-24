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
    // SQLite does not allow concurrent writes from multiple processes.
    // Run test files sequentially so integration tests never contend.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

