import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DB_PATH: ":memory:",
      JWT_SECRET: "test-secret",
    },
  },
});
