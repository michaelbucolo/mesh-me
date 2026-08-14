/**
 * THE NATIVE SWIFTUI APP — held from Linux.
 *
 * Swift does not compile on this CI (SwiftUI exists only in Apple SDKs), so
 * this gate holds what a compiler cannot anyway: the LAWS.
 *
 *   - FIVE TABS ARE LAW: Mesh, MeChat, Flow, Explore, Analytics — exactly,
 *     in the app shell, same as the web (navigation-config).
 *   - ONE BACKEND, REAL ROUTES: every "/api/..." path the Swift client names
 *     must exist as a route file under src/app/api/ — a renamed route fails
 *     here before it can fail a user's phone.
 *   - ONE PALETTE: MeshTheme.swift carries tokens.css's paper/ink/accent
 *     values verbatim. If the web palette moves, this fails until the native
 *     app follows.
 *   - ONE LOGIN: the native session route rides signInForEntry; it must
 *     never grow its own credential check.
 *   - NO EMOJI in chrome; pure SwiftUI (one sanctioned UIKit import for the
 *     dynamic-color bridge).
 *
 * WHAT THIS CANNOT DO: compile or run the app — that is Xcode's job on a
 * Mac (apple/MeshMe/README.md). This holds the contracts blind spots drift
 * through.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const APP = "apple/MeshMe";
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

function swiftFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...swiftFiles(rel));
    else if (name.endsWith(".swift")) out.push(rel);
  }
  return out;
}

const files = swiftFiles(APP);
const sources = new Map(files.map((f) => [f, read(f)]));
const allSwift = [...sources.values()].join("\n");
const allSwiftStripped = strip(allSwift);

// ── A. Five tabs are law ─────────────────────────────────────────────────────
{
  const root = strip(sources.get(`${APP}/MeshMe/Features/Shell/RootView.swift`) ?? "");
  if (!root) fail("A tabs", "RootView.swift is missing"); else ok();
  const tabItems = (root.match(/\.tabItem/g) ?? []).length;
  if (tabItems !== 5) {
    fail("A tabs", `${tabItems} tabItem calls — the law is exactly five`);
  } else ok();
  for (const name of ["Mesh", "MeChat", "Flow", "Explore", "Analytics"]) {
    if (!new RegExp(`Label\\("${name}"`).test(root)) {
      fail("A tabs", `the ${name} tab label is gone`);
    } else ok();
  }
}

// ── B. Every Swift API path is a real route ──────────────────────────────────
{
  const paths = new Set<string>();
  for (const match of allSwiftStripped.matchAll(/"(\/api\/[^"\s?]+)"/g)) paths.add(match[1]);
  // Interpolated paths ("/api/messages/\(threadId)") — capture the pattern.
  for (const match of allSwiftStripped.matchAll(/"(\/api\/[^"\s?]*\\\([^)]*\)[^"]*)"/g)) paths.add(match[1]);
  if (paths.size < 8) {
    fail("B routes", `scanner-sees floor: only ${paths.size} /api/ path literals found in Swift sources`);
  } else ok();

  const resolves = (apiPath: string): boolean => {
    const segments = apiPath.replace(/^\//, "").split("/").map((s) => (s.includes("\\(") ? "*" : s));
    let dirs = ["src/app"];
    for (const segment of segments) {
      const next: string[] = [];
      for (const dir of dirs) {
        if (segment === "*") {
          if (!existsSync(join(ROOT, dir))) continue;
          for (const name of readdirSync(join(ROOT, dir))) {
            if (name.startsWith("[") && statSync(join(ROOT, dir, name)).isDirectory()) next.push(`${dir}/${name}`);
          }
        } else if (existsSync(join(ROOT, dir, segment))) {
          next.push(`${dir}/${segment}`);
        }
      }
      dirs = next;
      if (dirs.length === 0) return false;
    }
    return dirs.some((dir) => existsSync(join(ROOT, dir, "route.ts")));
  };

  for (const apiPath of paths) {
    if (!resolves(apiPath)) {
      fail("B routes", `Swift calls ${apiPath} but no route.ts backs it under src/app/api`);
    } else ok();
  }
}

// ── C. One palette: MeshTheme ↔ tokens.css ───────────────────────────────────
{
  const theme = sources.get(`${APP}/MeshMe/Design/MeshTheme.swift`) ?? "";
  const tokens = read("src/app/tokens.css");
  // token name → the hex MeshTheme must carry for it. Values are asserted in
  // BOTH files so a change on either side breaks the pairing loudly.
  const pairs: Array<[string, string]> = [
    ["--paper-0", "#000000"], ["--paper-1", "#1c1c1e"], ["--paper-2", "#2c2c2e"],
    ["--ink-2", "#d1d1d1"], ["--ink-3", "#a8a8a8"],
    ["--accent", "#409cff"], ["--accent-hover", "#5aa9ff"],
    ["--paper-0", "#f2f2f7"], ["--paper-2", "#e9e9ee"],
    ["--ink-2", "#48484a"], ["--ink-3", "#636366"],
    ["--accent", "#0056d6"], ["--accent-hover", "#0062ea"],
  ];
  for (const [token, hex] of pairs) {
    const inCss = new RegExp(`${token}:\\s*${hex}`, "i").test(tokens);
    const inSwift = theme.toLowerCase().includes(`0x${hex.slice(1).toLowerCase()}`);
    if (!inCss) {
      fail("C palette", `${token} is no longer ${hex} in tokens.css — the web palette moved; move MeshTheme.swift with it and update this pairing`);
    } else ok();
    if (!inSwift) {
      fail("C palette", `MeshTheme.swift lost ${hex} (${token}) — the native app drifted off the product palette`);
    } else ok();
  }
}

// ── D. No emoji in chrome ────────────────────────────────────────────────────
{
  if (/\p{Extended_Pictographic}/u.test(allSwift)) {
    fail("D emoji", "an emoji codepoint appeared in the native app — SF Symbols are the icon vocabulary");
  } else ok();
}

// ── E. Pure SwiftUI ──────────────────────────────────────────────────────────
{
  for (const [file, source] of sources) {
    if (/^import UIKit/m.test(source) && !file.endsWith("MeshTheme.swift")) {
      fail("E swiftui", `${file} imports UIKit — the one sanctioned import is MeshTheme's dynamic-color bridge`);
    } else ok();
  }
}

// ── F. The client proves its first party ─────────────────────────────────────
{
  const api = strip(sources.get(`${APP}/MeshMe/Core/MeshAPI.swift`) ?? "");
  // BOTH write verbs (post and patch) must prove first party — one carrying
  // the header while the other dropped it is exactly the drift this caught
  // in mutation testing.
  if ((api.match(/forHTTPHeaderField: "Origin"/g) ?? []).length < 2) {
    fail("F origin", "a write verb in MeshAPI no longer sends the Origin header — its requests will 403 at the same-origin guard");
  } else ok();
  if (!api.includes("www.meshs.me")) {
    fail("F origin", "MeshAPI's host drifted off www.meshs.me — the guard compares host strings; apex and www are different hosts to it");
  } else ok();
}

// ── G. One login, one inbox — the backend side ───────────────────────────────
{
  const nativeSession = strip(read("src/app/api/auth/native-session/route.ts"));
  if (!/signInForEntry\(/.test(nativeSession)) {
    fail("G one-login", "native-session no longer rides signInForEntry");
  } else ok();
  if (/verifyPassword|bcrypt|passwordHash/.test(nativeSession)) {
    fail("G one-login", "native-session grew its own credential check — there is ONE definition of signing in");
  } else ok();
  if (!/isSameOriginRequest/.test(nativeSession)) {
    fail("G one-login", "native-session POST lost its same-origin guard");
  } else ok();
  const inboxRoute = strip(read("src/app/api/inbox/route.ts"));
  if (!/readInbox\(/.test(inboxRoute)) {
    fail("G one-login", "/api/inbox no longer serves readInbox — the one owed judgement");
  } else ok();
  if (/senderId|wantsYou\(/.test(inboxRoute)) {
    fail("G one-login", "/api/inbox grew its own logic — it must stay a doorway to readInbox");
  } else ok();
}

// ── H. Project + scanner integrity ───────────────────────────────────────────
{
  if (!existsSync(join(ROOT, APP, "project.yml"))) {
    fail("H integrity", "project.yml (the XcodeGen source of truth) is missing");
  } else ok();
  if (!read(`${APP}/README.md`).includes("xcodegen")) {
    fail("H integrity", "the README no longer says how to generate the Xcode project");
  } else ok();
  if (files.length < 10) {
    fail("H integrity", `only ${files.length} Swift files — the scanner may be looking at the wrong tree`);
  } else ok();
  if (allSwift.length < 30_000) {
    fail("H integrity", "the Swift sources shrank implausibly");
  } else ok();
}

if (failures.length) {
  console.error(`\nswift-app: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`swift-app: all ${checks} assertions passed — five tabs, one palette, one backend, one login.`);
