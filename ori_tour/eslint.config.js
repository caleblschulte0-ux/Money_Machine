// Lint: typescript-eslint's type-aware recommended rules, plus the rule that
// keeps the core portable (no browser or Node globals in src/core).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "sw.js", "eslint.config.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["src/web/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["test/**/*.ts"],
    languageOptions: { globals: globals.node },
    // node:test returns a promise from test(); the runner awaits it
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
  {
    // The portability rule: core code may not reach for a platform. Use a port.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...[
          "window",
          "document",
          "navigator",
          "localStorage",
          "fetch",
          "setTimeout",
          "setInterval",
          "process",
          "require",
          "location",
          "screen",
        ].map((name) => ({
          name,
          message: "src/core must stay platform-free: go through a port in src/core/ports.ts.",
        })),
      ],
      "no-restricted-properties": ["error", { object: "Date", property: "now", message: "Use the Clock port." }],
    },
  },
);
