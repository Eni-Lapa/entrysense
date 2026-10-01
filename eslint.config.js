// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Dependency rule: source dependencies point inwards.
 * domain <- application <- (infrastructure, http) <- container, server
 *
 * @param {string[]} files
 * @param {string[]} forbidden
 * @param {string} message
 * @returns {import("typescript-eslint").ConfigWithExtends}
 */
const layer = (files, forbidden, message) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: forbidden.map((group) => ({ group: [group], message })) }],
  },
});

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "error",
    },
  },
  layer(
    ["src/domain/**"],
    ["**/application/**", "**/infrastructure/**", "**/http/**", "**/container*"],
    "The domain layer must not depend on outer layers.",
  ),
  layer(
    ["src/application/**"],
    ["**/infrastructure/**", "**/http/**", "**/container*"],
    "Use cases depend on ports, not on adapters or transport.",
  ),
  layer(
    ["src/http/**"],
    ["**/infrastructure/**", "**/container*"],
    "HTTP receives its dependencies from the composition root.",
  ),
  layer(["src/infrastructure/**"], ["**/http/**", "**/container*"], "Adapters must not depend on transport."),
  {
    files: ["eval/**", "src/infrastructure/persistence/migrate.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
