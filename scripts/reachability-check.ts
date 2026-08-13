// A PAGE NOBODY CAN GET TO, AND A PROMISE TO CRAWLERS NOBODY KEPT.
//
// knip is clean and `dead-code:check` gates the build, so "an exported function
// with no importer" is empty by construction in this repo. That gives a
// comfortable and false impression of coverage, because knip reasons about
// MODULE graphs and a user does not navigate the module graph. They navigate
// links.
//
// Two failures live entirely in that blind spot, and an audit found both:
//
//   1. src/app/sitemap.ts advertised `/roadmap` to every search engine that
//      read it. There is no /roadmap route. `find src/app -ipath "*roadmap*"`
//      returns nothing. A sitemap is a list of promises and nothing in the
//      build checked that they resolve.
//
//   2. /communities/create — a real page wrapping a real form — had ZERO
//      inbound links. Not a button, not a menu entry, not a redirect. The only
//      creation path for an entire surface was reachable only by typing the URL
//      from memory. The route's own metadata says "Create, discover, post,
//      chat, and moderate", and four of those five were true.
//
// Neither is a broken build, a type error, or dead code. Both are a person
// unable to reach something that works. That is what this gate measures.
//
// ── WHY THE MATCHING IS FUSSIER THAN IT LOOKS ───────────────────────────────
//
// The first version of this file flagged two routes that were perfectly
// reachable, and both false positives are worth keeping in mind, because a gate
// that cries wolf gets exemption-listed until it means nothing:
//
//   • /offline is named by public/sw.js — the service worker, which is not
//     TypeScript and does not live under src/. A route can be reached from
//     places the app's own source tree does not contain.
//
//   • /profile/[username]/connections is linked from profile-view.tsx as
//     `/profile/${profile.username}/connections`. Searching for the literal
//     string finds nothing, because nobody writes the brackets. Dynamic
//     segments have to be matched as the interpolations they actually are.
//
// So: the corpus is wider than src, and a route's pattern tolerates `${...}`
// wherever the filesystem has a [param].

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

type Route = {
  /** URL path as the filesystem spells it, [param] segments included. */
  url: string;
  /** The app directory that owns it, so its own files can be excluded. */
  dir: string;
};

/** Every app route that renders a page. */
function routePaths(): Route[] {
  const found: Route[] = [];
  const walk = (dir: string, url: string) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      // (group) segments organise files without appearing in the URL.
      // @parallel and [...catchall] slots are not navigable paths of their own.
      const isGroup = name.startsWith("(") && name.endsWith(")");
      if (name.startsWith("@") || name.startsWith("[...") || name.startsWith("[[")) continue;
      const childDir = `${dir}/${name}`;
      const nextUrl = isGroup ? url : `${url}/${name}`;
      if (!isGroup && existsSync(join(ROOT, childDir, "page.tsx"))) {
        found.push({ url: nextUrl, dir: childDir });
      }
      walk(childDir, nextUrl);
    }
  };
  walk("src/app", "");
  return found;
}

const routes = routePaths();
assert.ok(routes.length > 15, `only ${routes.length} routes discovered; a walk that finds nothing passes everything.`);
checks += 1;

// ── 1. THE SITEMAP MAY NOT PROMISE A ROUTE THAT DOES NOT EXIST ──────────────
{
  const sitemap = readFileSync(join(ROOT, "src/app/sitemap.ts"), "utf8");
  // `${siteUrl}/thing` — the only shape this file uses.
  const advertised = [...sitemap.matchAll(/\$\{siteUrl\}(\/[a-z0-9\-/]*)/gi)]
    .map((m) => m[1].replace(/\/$/, ""))
    .filter((p) => p.length > 0);

  assert.ok(advertised.length > 3, `parsed only ${advertised.length} sitemap URLs; expected the real list.`);
  checks += 1;

  const staticRoutes = new Set(routes.map((r) => r.url));
  const missing = advertised.filter((p) => !staticRoutes.has(p));
  assert.deepEqual(
    missing,
    [],
    "the sitemap advertises routes that do not exist:\n" +
      missing.map((p) => `    ${p}`).join("\n") +
      "\n  Every one of these is a 404 served to a crawler that trusted the file. Either build the\n" +
      "  page or remove the entry — a sitemap is a list of promises, and nothing else in the build\n" +
      "  checks that they resolve.",
  );
  checks += 1;
}

// ── 2. EVERY PAGE MUST BE REACHABLE FROM SOMEWHERE ──────────────────────────
//
// "Reachable" means some file OUTSIDE the route's own directory names the path
// — an href, a redirect, a router.push, a nav config entry, a service worker
// constant. That is not proof a human can find the link, but it does catch the
// total orphan, which is the case that actually happened.
{
  const sources: { file: string; text: string }[] = [];
  const walkFiles = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walkFiles(rel);
      else if (/\.(tsx?|m?js)$/.test(entry.name)) {
        sources.push({ file: rel, text: readFileSync(join(ROOT, rel), "utf8") });
      }
    }
  };
  walkFiles("src");
  // public/ holds the service worker, which names /offline and nothing in src
  // does. A link out of a non-TypeScript file is still a link.
  walkFiles("public");

  assert.ok(
    sources.some((s) => s.file === "public/sw.js"),
    "the service worker is missing from the corpus; /offline is reachable only from it.",
  );
  checks += 1;

  // Routes that are deliberately URL-only, each with the reason it is exempt.
  // An exemption is a decision someone made on purpose; an orphan is one nobody
  // made at all, and the difference is this list.
  const INTENTIONALLY_UNLINKED: Record<string, string> = {
    "/watch": "A watch-scale surface for a 40mm screen, opened from a watch face rather than from inside the app.",
    "/login": "Reached by redirect from the proxy on any protected route, not by a link.",
    "/signup": "Entered from the marketing site and the login page's own flow.",
    "/logout": "Posted to, never linked.",
    "/reset-password": "Reached from an emailed link.",
    "/verify-email": "Reached from an emailed link.",
    "/onboarding": "Redirected into after signup.",
    "/share": "The Web Share Target entry point; the OS opens it.",
    "/pricing": "An external/SEO landing that redirects to /meshpro.",
  };

  /**
   * Turn a filesystem route into something that matches how the path is
   * actually written in source. `/profile/[username]/connections` appears as
   * `` `/profile/${profile.username}/connections` ``, so a [param] has to match
   * an interpolation as readily as a literal segment.
   */
  function routePattern(url: string): RegExp {
    const body = url
      .split("/")
      .filter(Boolean)
      .map((segment) =>
        segment.startsWith("[")
          ? "(?:\\$\\{[^}]*\\}|[A-Za-z0-9_%-]+)"
          : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    // Ends at a quote, a query string, a hash, or a further interpolation —
    // so /communities does not match /communities/create and call it reached.
    return new RegExp(`["'\`]/${body}(?:["'\`?#]|\\$\\{)`);
  }

  const orphans: string[] = [];
  for (const route of routes) {
    if (route.url === "") continue; // the root page
    if (route.url in INTENTIONALLY_UNLINKED) continue;
    const pattern = routePattern(route.url);
    // A link from inside the thing you are trying to reach does not help you
    // reach it, so the route's own directory does not count as an inbound link.
    const linked = sources.some((s) => !s.file.startsWith(`${route.dir}/`) && pattern.test(s.text));
    if (!linked) orphans.push(route.url);
  }

  assert.deepEqual(
    orphans,
    [],
    "these pages exist and nothing links to them:\n" +
      orphans.map((p) => `    ${p}`).join("\n") +
      "\n  A working page nobody can navigate to is indistinguishable from a page that was never\n" +
      "  built. Add a link, or add it to INTENTIONALLY_UNLINKED with the reason it is URL-only —\n" +
      "  an exemption is a decision; an orphan is nobody having made one.",
  );
  checks += 1;

  // ── 3. EVERY API ROUTE MUST HAVE A CALLER, OR A STATED REASON NOT TO ───────
  //
  // Same failure, different shape. /api/security-hub/overview was forty working
  // lines that counted a real thing and that nothing had ever called; its only
  // mention in the repo was the proxy's route list, so that a request nobody
  // made would be authenticated correctly. Three more were HTTP wrappers around
  // server actions the UI already called directly — a second writer for one
  // fact, which is the failure this codebase keeps repeating.
  //
  // knip cannot see any of this: a route.ts is an entry point by definition, so
  // an endpoint with no client is dead code that is structurally invisible to
  // the dead-code checker.
  //
  // Plenty of endpoints are legitimately called by someone who is not us, and
  // those are named here rather than guessed at from a naming convention.
  const EXTERNAL_CALLERS: Record<string, string> = {
    "/api/health": "Uptime monitoring. Called by things outside this repo, by design.",
    "/api/status": "Public status surface, polled externally.",
    "/api/stripe/webhook": "Stripe posts here. Verified by signature, never called by us.",
    "/api/compose/scheduler": "Vercel's cron ticks this (vercel.json). Bearer-secret only; no session path.",
    "/api/auth/[platform]/callback": "The OAuth redirect target. The platform sends the browser here.",
    "/api/auth/identity/[provider]": "Sign-in with a third-party identity provider; entered by navigation.",
    "/api/auth/identity/[provider]/callback": "The identity provider's redirect target.",
    "/api/auth/meta/deauthorize": "Meta calls this when someone removes the app there. Required by Meta.",
    "/api/auth/meta/deletion": "Meta's data-deletion callback. Required by Meta.",
    "/api/adult-verification/callback": "The verification provider's redirect target.",
    "/api/public-supply/refresh": "Hourly Vercel cron. Fails closed without PUBLIC_SUPPLY_CRON_SECRET.",
    "/api/auth/logout": "Posted to by a form, which names it as an action rather than as a fetch URL.",
    "/api/avatar": "An <img src> target — referenced as a URL in markup, not fetched in code.",
    "/api/banner": "An <img src> target, same as /api/avatar.",
  };

  // A DIFFERENT THING FROM AN EXEMPTION, AND KEPT SEPARATE SO IT CANNOT ROT
  // INTO ONE. These endpoints have no caller and no external one either. They
  // are finished, correct, and waiting on a surface that has not been built.
  // Every entry must name what will call it, so the list reads as work owed
  // rather than as a place to put things nobody wants to think about.
  const UNWIRED_PENDING_UI: Record<string, string> = {
    "/api/account/alter-egos":
      "Personas. GET/POST/DELETE, rate-limited, MAX_ALTER_EGOS enforced, username uniqueness checked " +
      "against both User and AlterEgo — finished and correct. But this is NOT simply a missing front " +
      "door. /connected-accounts displays personas under the line 'Fold a separate persona's " +
      "connections into your one mesh.me account — nothing stays split off', and its only action is " +
      "foldPersonaIntoMainIdentity, which deactivates the persona and nulls alterEgoId on its " +
      "accounts. A create button there would contradict the sentence above it. ConnectedAccount." +
      "alterEgoId is modelled but written by no application code at all, so the 'group accounts under " +
      "a persona' capability has no writer either. Owed: a product decision before a form — either " +
      "build personas properly (one account, more than one face, with that page's copy reconciled) or " +
      "delete POST/DELETE and keep GET for personas that arrive by merge. Tier 2 in " +
      "docs/SURFACE_AUDIT.md.",
  };

  const apiRoutes: string[] = [];
  const walkApi = (dir: string, url: string) => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    if (existsSync(join(ROOT, dir, "route.ts"))) apiRoutes.push(url);
    for (const entry of entries) {
      if (entry.isDirectory()) walkApi(`${dir}/${entry.name}`, `${url}/${entry.name}`);
    }
  };
  walkApi("src/app/api", "/api");

  assert.ok(apiRoutes.length > 20, `only ${apiRoutes.length} API routes found; a walk that finds nothing passes everything.`);
  checks += 1;

  // An entry that does not say what will call it is not a plan, so it does not
  // count as one.
  for (const [url, reason] of Object.entries(UNWIRED_PENDING_UI)) {
    assert.ok(
      /\bOwed:/.test(reason),
      `${url} is listed as unwired without saying what will call it. State the owed work, or delete the route.`,
    );
    checks += 1;
  }

  const uncalled: string[] = [];
  for (const url of apiRoutes) {
    if (url in EXTERNAL_CALLERS) continue;
    if (url in UNWIRED_PENDING_UI) continue;
    const dir = `src/app${url}`;
    const pattern = routePattern(url);
    // A route calling itself is not a caller. Nor is the proxy's allowlist,
    // which only decides how a request would be authenticated IF one arrived.
    const called = sources.some(
      (s) => !s.file.startsWith(`${dir}/`) && s.file !== "src/proxy.ts" && pattern.test(s.text),
    );
    if (!called) uncalled.push(url);
  }

  assert.deepEqual(
    uncalled,
    [],
    "these API routes exist and nothing calls them:\n" +
      uncalled.map((p) => `    ${p}`).join("\n") +
      "\n  An endpoint with no client is dead code that knip cannot see, because a route.ts is an\n" +
      "  entry point by definition. Delete it, wire it up, or add it to EXTERNAL_CALLERS with the\n" +
      "  name of whoever outside this repo actually calls it.",
  );
  checks += 1;
}

console.log(
  `reachability OK — ${checks} assertions over ${routes.length} routes.\n` +
    "  The sitemap promises nothing that 404s, and every page is linked from somewhere or is\n" +
    "  listed as deliberately URL-only with a stated reason. Dynamic [param] segments are matched\n" +
    "  through their `${...}` interpolations, and the corpus includes public/ so a route named\n" +
    "  only by the service worker still counts as reached.\n" +
    "  Every API route has a caller, an external one named in EXTERNAL_CALLERS, or a stated debt in\n" +
    "  UNWIRED_PENDING_UI saying what is owed — knip cannot see any of that, because a route.ts is\n" +
    "  an entry point by definition and an endpoint with no client is invisible dead code.\n" +
    "  Does NOT cover: whether a human can FIND the link, only that one exists.",
);
