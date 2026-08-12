/**
 * --mesh-text MUST TRACK --text-primary, NOT fork to raw ink.
 *
 * The whole app reads `--text-primary`/`--text-secondary`, but the profile,
 * message-list and analytics surfaces read `--mesh-text`/`--mesh-text-secondary`.
 * Those were `var(--ink-1)`/`var(--ink-2)` — pure #000/#fff — while the
 * system-light `@media` block overrides `--text-primary` to a softer slate and
 * leaves `--mesh-text` alone. Result: in the default (no explicit theme) light
 * state, half the app is slate primary text and the mesh-text surfaces are pure
 * black — a visible fork in the single most repeated thing on screen.
 *
 * The fix makes `--mesh-text` an alias of `--text-primary` so it inherits every
 * theme override for free. This gate stops it forking back: any `--mesh-text` /
 * `--mesh-text-secondary` definition must resolve to the text token, never to a
 * raw `--ink-*` or a literal hex.
 */
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const css = readFileSync(`${ROOT}/src/app/globals.css`, "utf8");

const failures: string[] = [];
const rules: Array<[string, string]> = [
  ["--mesh-text", "--text-primary"],
  ["--mesh-text-secondary", "--text-secondary"],
];

for (const [name, mustAlias] of rules) {
  // Every definition of this custom property, wherever it is scoped.
  const re = new RegExp(`${name.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+);`, "g");
  let m: RegExpExecArray | null;
  let seen = 0;
  while ((m = re.exec(css))) {
    seen += 1;
    const value = m[1].trim();
    if (value !== `var(${mustAlias})`) {
      const line = css.slice(0, m.index).split("\n").length;
      failures.push(`globals.css:${line}: ${name} is \`${value}\`, must be \`var(${mustAlias})\` so it tracks every theme override`);
    }
  }
  if (seen === 0) failures.push(`${name} is not defined at all — scanner is stale or the token was renamed`);
}

if (failures.length) {
  console.error("token-alias-check FAILED\n");
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log("token-alias OK — --mesh-text and --mesh-text-secondary alias the theme-tracked text tokens.");
