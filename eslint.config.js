import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/core/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/core/**/*.ts"],
    ignores: ["src/core/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react-dom/*",
                "react/*",
                "react-router",
                "react-router-dom",
                "@/components/*",
                "@/pages/*",
                "@/hooks/*",
                "@/lib/*",
                "@/integrations/*",
              ],
              message: "src/core must stay framework-free (see AGENTS.md)",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message: "Use the explicit asOfDate; never read the clock in src/core (see AGENTS.md).",
        },
        {
          object: "Math",
          property: "random",
          message: "Deterministic core: do not use Math.random in src/core (see AGENTS.md).",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Use the explicit asOfDate; never read the clock in src/core.",
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Use of window is forbidden in src/core." },
        { name: "document", message: "Use of document is forbidden in src/core." },
        { name: "localStorage", message: "Use of localStorage is forbidden in src/core." },
        { name: "sessionStorage", message: "Use of sessionStorage is forbidden in src/core." },
        { name: "fetch", message: "Use of fetch is forbidden in src/core." },
      ],
      "no-console": "error",
    },
  },
  eslintPluginPrettier,
);
