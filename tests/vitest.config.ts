import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    root: __dirname,
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
