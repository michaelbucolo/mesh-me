import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    // Throwaway browser-driving scripts. This directory is gitignored; it is
    // where audit runs and one-off probes write, and holding them to the
    // product's lint budget only ever produced noise that broke `npm run check`
    // for reasons unrelated to anything that ships.
    "scratchpad/**",
  ]),
]);

export default eslintConfig;
