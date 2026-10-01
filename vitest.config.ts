import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Process entry points and SDK wiring are exercised by running the app, not by unit tests.
      exclude: ["src/server.ts", "src/infrastructure/persistence/migrate.ts", "src/infrastructure/observability/**"],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
