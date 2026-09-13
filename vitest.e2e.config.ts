import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 60000,
  },
});
