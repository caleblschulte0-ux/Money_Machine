import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/*/src/**/*.test.ts",
      "ventures/*/src/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    globals: false,
    passWithNoTests: false,
    env: {
      NODE_ENV: "test",
      STORE_DRIVER: "memory",
      ALLOW_PAID_PROVIDERS: "false",
      ALLOW_LIVE_COMMUNICATIONS: "false",
    },
  },
});
