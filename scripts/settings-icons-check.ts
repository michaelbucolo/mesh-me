/**
 * ICON-LED SETTINGS — every control leads with a glyph; no control's
 * meaning lives only in a glyph.
 *
 * The owner asked for "almost all controls icon-based; simplify" and later
 * shipped plain language and kept every word. The settled harmonization
 * (verified against the shipped history: #280 plain language → #354
 * icon-forward "explanations kept word-for-word" → #543 honest icons):
 * icon-LED everywhere, icon-ONLY nowhere new, simplify = fewer idioms and
 * fewer restatements, never fewer words or capabilities.
 *
 * WHAT THIS CANNOT DO: judge whether a glyph MEANS anything at 15px — that
 * is the browser drive's job, by eye. This holds the mechanical floor.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const source = strip(read("src/components/settings/settings-control-center.tsx"));

// Walk every opening tag of the given name at brace depth — a naive regex
// dies on arrow functions inside props (the silent-selection lesson).
function openingTags(text: string, tag: string): string[] {
  const out: string[] = [];
  let at = 0;
  for (;;) {
    const start = text.indexOf(`<${tag}`, at);
    if (start < 0) break;
    const after = text[start + tag.length + 1];
    if (after && /[A-Za-z0-9]/.test(after)) { at = start + 1; continue; }
    let depth = 0;
    let end = start;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0) { end = i; break; }
    }
    out.push(text.slice(start, end + 1));
    at = end + 1;
  }
  return out;
}

// ── A. One visibility vocabulary ─────────────────────────────────────────────
{
  if (!/const visibilityChoices = \[/.test(source)) {
    fail("A visibility", "the visibilityChoices tuple is gone — the single vocabulary broke");
  } else ok();
  const tuple = source.slice(source.indexOf("const visibilityChoices"), source.indexOf("] as const;", source.indexOf("const visibilityChoices")));
  for (const value of ["public", "friends", "private"]) {
    if (!tuple.includes(`"${value}"`)) {
      fail("A visibility", `the vocabulary lost "${value}"`);
    } else ok();
  }
  if (/"partial"/.test(tuple)) {
    fail("A visibility", "partial entered the assignable vocabulary — it is derived overall state, not a branch value");
  } else ok();
  const component = source.slice(source.indexOf("function VisibilityChoice"));
  if (source.indexOf("function VisibilityChoice") < 0 || !/aria-pressed=\{value === choice\.value\}/.test(component.slice(0, 1600))) {
    fail("A visibility", "VisibilityChoice lost its pressed state — silent selection");
  } else ok();
  if (/visibilityOptions\.slice/.test(source)) {
    fail("A visibility", "the branch dropdowns are back — one fact, two idioms again");
  } else ok();
  if ((source.match(/<VisibilityChoice/g) ?? []).length < 2) {
    fail("A visibility", "VisibilityChoice lost a call site — profile and branches must both ride it");
  } else ok();
}

// ── B. Choice chips carry honest visuals ─────────────────────────────────────
{
  const chips = openingTags(source, "ChoiceButton");
  if (chips.length < 6) {
    fail("B chips", `scanner-sees floor: only ${chips.length} ChoiceButton openings found`);
  } else ok();
  // The digest select is gone; its three values are aria-pressed chips.
  if (/<select[\s\S]{0,300}emailDigest/.test(source)) {
    fail("B chips", "the email digest select is back");
  } else ok();
  for (const value of ["off", "daily", "weekly"]) {
    if (!new RegExp(`emailDigest === "${value}"`).test(source)) {
      fail("B chips", `the digest chip for "${value}" is gone`);
    } else ok();
  }
  // Theme presets: the swatch is DERIVED via data-theme scoping — never a
  // second color table keyed by preset id.
  const presetMap = source.slice(source.indexOf("themePresets.map"), source.indexOf("PickerGroup", source.indexOf("themePresets.map")));
  if (!/data-theme=\{themePreset\.id\}/.test(presetMap)) {
    fail("B chips", "preset chips lost their data-theme-scoped swatch");
  } else ok();
  if (/#[0-9a-fA-F]{6}[\s\S]{0,40}themePreset\.id|themePreset\.id[\s\S]{0,40}#[0-9a-fA-F]{6}/.test(presetMap)) {
    fail("B chips", "a per-preset hex appeared beside the preset id — the second color table the postmortem forbids");
  } else ok();
  if (!/nodeStyleSpecimens\[style\]/.test(source)) {
    fail("B chips", "node-style chips lost their rendered specimens");
  } else ok();
}

// ── C. Select census: exactly one, and it is the state picker ────────────────
{
  const selects = (source.match(/<select/g) ?? []).length;
  if (selects !== 1) {
    fail("C census", `${selects} <select> sites — the allowlist is exactly one (the US state picker; 50 values, and state flags are emoji)`);
  } else ok();
  const selectAt = source.indexOf("<select");
  if (!/usStates\.map/.test(source.slice(selectAt, selectAt + 800))) {
    fail("C census", "the one allowed select is not the US state picker");
  } else ok();
}

// ── D. The icon-required ratchet ─────────────────────────────────────────────
{
  for (const sig of [/icon: LucideIcon;\s*label: string;\s*description\?: string/, /\{ label: string; icon: LucideIcon; children: ReactNode/]) {
    if (!sig.test(source)) {
      fail("D ratchet", `an icon-required signature drifted: ${String(sig).slice(0, 50)}...`);
    } else ok();
  }
  if (/icon\?: LucideIcon;\s*label: string;\s*description\?/.test(source) || /\{ label: string; icon\?: LucideIcon; children/.test(source)) {
    fail("D ratchet", "Toggle or Field made icon optional again");
  } else ok();
}

// ── E. No glyph-only controls beyond the named allowlist ─────────────────────
{
  const buttons = [...openingTags(source, "button"), ...openingTags(source, "Link")];
  if (buttons.length < 10) {
    fail("E words", `scanner-sees floor: only ${buttons.length} button/Link openings found`);
  } else ok();
  const glyphOnly = buttons.filter((tag) => /aria-label=/.test(tag));
  for (const tag of glyphOnly) {
    if (!/aria-label=(\{`|")Remove /.test(tag)) {
      fail("E words", `a control's accessible name lives only in aria-label (outside the Remove-key allowlist): ${tag.slice(0, 90)}...`);
    } else ok();
  }
}

// ── F. No emoji in chrome ────────────────────────────────────────────────────
{
  if (/\p{Extended_Pictographic}/u.test(source)) {
    fail("F emoji", "an emoji codepoint appeared in the settings surface — lucide is the icon vocabulary");
  } else ok();
}

// ── G. Scanner integrity ─────────────────────────────────────────────────────
{
  const pressed = (source.match(/aria-pressed/g) ?? []).length;
  if (pressed < 4) {
    fail("G integrity", `only ${pressed} aria-pressed occurrences — a scanner that sees no pressed controls is broken`);
  } else ok();
  if (source.length < 50_000) {
    fail("G integrity", "the settings surface shrank implausibly — the scanner may be reading the wrong file");
  } else ok();
}

if (failures.length) {
  console.error(`\nsettings-icons: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`settings-icons: all ${checks} assertions passed — icon-led everywhere, words everywhere, one idiom per fact.`);
