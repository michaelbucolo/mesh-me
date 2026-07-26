/**
 * SELECTION IS NOT A COLOUR.
 *
 * A control that is "the chosen one" must say so on the control, not only in
 * paint. Every button whose className branches on a selected/active boolean has
 * to carry aria-pressed, aria-selected, aria-current, aria-checked, or an
 * explicit role — otherwise assistive tech is handed a row of identical buttons
 * with no indication which one is in force.
 *
 * This was not hypothetical. Four live sites shipped that way:
 *
 *   - the MeChat conversation filter (All / Direct / Groups / Channels /
 *     Synced): five chips, zero aria-pressed, zero role. A screen reader got a
 *     bare list of buttons while one of them was narrowing the list.
 *   - the post composer's VISIBILITY selector — who can see this post. The
 *     chosen audience was the cobalt mould and nothing else.
 *   - both controls in the privacy permissions panel: whether a connected app
 *     has access at all, and which scopes it may read.
 *
 * Writing this detector took three wrong versions, and each failure is a trap
 * worth naming, because the naive form silently passes:
 *
 *   1. `/<button[\s\S]*?>/` ends at the FIRST `>`. `onClick={() => ...}`
 *      contains one, so the match stops before className is ever seen. The tag
 *      must be walked with brace/paren/quote depth.
 *   2. `\bactive\b` matches the Tailwind VARIANT `active:scale-90` sitting in
 *      the class text. Five flow-client buttons looked like defects and were
 *      not. The state word must be matched against CODE, never class strings.
 *   3. Matching the whole tag flags `setAttachments((current) => ...)`, because
 *      `current` is the conventional setState parameter. Only the className
 *      expression counts.
 *
 * Each version was checked by putting the original MeChat defect back and
 * requiring the detector to find it. A detector that reports zero because it
 * cannot see is worse than none, since it reads as proof. The stateful-button
 * count below is the same guard, kept permanently: a clean run that scanned no
 * state-driven buttons at all is a broken scanner, and fails.
 *
 * WHAT THIS DOES NOT CATCH, stated plainly: it keys on the NAME of the boolean.
 * A selector written `className={visibility === option.id ? ... : ...}`, with no
 * selected/active/current identifier anywhere, passes. Widening the vocabulary
 * to arbitrary comparisons produced more false positives than findings, so the
 * gate holds the convention rather than the concept. It is a floor, not a proof.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) tsxFiles(rel, out);
    else if (rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/** Opening tags read in full, so an arrow function's `>` cannot end them early. */
function openingTags(src: string, tag: string) {
  const out: { index: number; attrs: string }[] = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    let tick = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      const prev = src[i - 1];
      if (quote) {
        if (c === quote && prev !== "\\") quote = null;
        continue;
      }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === "`") { tick ^= 1; continue; }
      if (tick) continue;
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ index: m.index, attrs: src.slice(m.index + m[0].length, i) });
  }
  return out;
}

/** Just the className={...} value — see trap 3. */
function classNameExpr(attrs: string): string | null {
  const at = attrs.indexOf("className=");
  if (at < 0) return null;
  const open = attrs.indexOf("{", at);
  if (open < 0 || open > at + "className=".length) return null;
  let depth = 0;
  let quote: string | null = null;
  let tick = 0;
  for (let j = open; j < attrs.length; j++) {
    const c = attrs[j];
    const prev = attrs[j - 1];
    if (quote) { if (c === quote && prev !== "\\") quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "`") { tick ^= 1; continue; }
    if (tick) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return attrs.slice(open, j + 1); }
  }
  return null;
}

/** Only what the engine evaluates: no quoted strings, no template TEXT — trap 2. */
function codeOnly(s: string): string {
  let out = "";
  let quote: string | null = null;
  let tickText = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1];
    if (quote) { if (c === quote && prev !== "\\") quote = null; continue; }
    if (tickText) {
      if (c === "`") { tickText = false; continue; }
      if (c === "$" && s[i + 1] === "{") { tickText = false; depth = 1; i += 1; out += " "; continue; }
      continue;
    }
    if (depth > 0) {
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { tickText = true; out += " "; continue; } }
      out += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += " "; continue; }
    if (c === "`") { tickText = true; out += " "; continue; }
    out += c;
  }
  return out;
}

const STATE = /\b(selected|isSelected|isActive|active|isCurrent|current|isEnabled|isOn|isChecked)\b/;
const ANNOUNCES = /aria-pressed|aria-selected|aria-current|aria-checked|role=["{]/;

const offenders: string[] = [];
let scanned = 0;
let stateful = 0;

for (const file of tsxFiles("src")) {
  const src = readFileSync(join(ROOT, file), "utf8");
  for (const tag of openingTags(src, "button")) {
    scanned += 1;
    const cls = classNameExpr(tag.attrs);
    if (!cls) continue;
    if (!STATE.test(codeOnly(cls))) continue;
    stateful += 1;
    if (ANNOUNCES.test(tag.attrs)) continue;
    offenders.push(`${file}:${src.slice(0, tag.index).split("\n").length}`);
  }
}

// The detector must be able to SEE. If it finds no stateful buttons at all,
// something upstream broke and a clean report would be a lie.
if (stateful === 0) {
  console.error("\nsilent-selection: found no state-driven buttons anywhere — the scanner is broken, not the codebase\n");
  process.exit(1);
}

if (offenders.length) {
  console.error(`\nsilent-selection: ${offenders.length} button(s) show selection in paint alone\n`);
  for (const o of offenders) console.error(`  ${o}`);
  console.error("\n  Add aria-pressed (toggle), aria-selected (tab), aria-current (nav) or aria-checked (radio).\n");
  process.exit(1);
}

console.log(`silent-selection: ${stateful} state-driven buttons across ${scanned} scanned — every one announces its state.`);
