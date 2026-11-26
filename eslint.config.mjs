import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Every image here is a user upload or a generated result served from
      // /api; next/image's resizing would add a second encode for nothing.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not the web app: the Python fine-tuning project (its .venv ships
    // third-party JS) and the CommonJS scripts that build the BTP report.
    "ml/**",
    "docs/**",
  ]),
]);

export default eslintConfig;
