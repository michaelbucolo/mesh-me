/**
 * ONE PLACE DECIDES WHAT A PLATFORM IS CALLED.
 *
 * There were five, and they disagreed. Three local `platformLabel` helpers
 * (MeChat, Search, the external-post page), one `label` field on the feed
 * card's badge map, and four surfaces that applied a CSS `capitalize` to the
 * raw storage key. Measured against real ids that shipped:
 *
 *     tiktok    -> "Tiktok"    on Settings, Profile, Analytics, Privacy
 *     linkedin  -> "Linkedin"        "
 *     youtube   -> "Youtube"         "
 *     twitter   -> "Twitter"         "     but "X" in MeChat and Search
 *
 * The last line is the damage this gate exists to prevent: mesh.me called the
 * same platform two different names on two different pages, and one of them
 * contradicted lib/platforms.ts, where it is "X".
 *
 * `capitalize` is the root cause and it cannot be fixed by being more careful.
 * It has no way to know TikTok has a capital T in the middle. Only a table can,
 * which is why getDisplayNameForAnyPlatform exists and why nothing may route
 * around it.
 *
 * ── WHAT THIS CANNOT PROVE ──────────────────────────────────────────────────
 *
 * That a name is CORRECT — it asserts the ones known to be tricky and that no
 * surface reconstructs names on its own. A platform added to the allow-list
 * with a misspelled name passes this gate and is wrong everywhere at once,
 * which is the trade for having one source instead of five.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDisplayNameForAnyPlatform } from "../src/lib/platform-capabilities";
import { MESH_PLATFORM_IDS } from "../src/lib/platforms";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

// ── 1. The names that `capitalize` gets wrong ───────────────────────────────
//
// Every one of these shipped misspelled. They are asserted by hand because
// they are precisely the cases a mechanical rule cannot derive.
{
  const EXPECTED: Record<string, string> = {
    twitter: "X",
    tiktok: "TikTok",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    facebook: "Facebook",
    threads: "Threads",
    snapchat: "Snapchat",
    reddit: "Reddit",
    pinterest: "Pinterest",
    twitch: "Twitch",
    discord: "Discord",
  };

  for (const [id, expected] of Object.entries(EXPECTED)) {
    const actual = getDisplayNameForAnyPlatform(id);
    if (actual !== expected) {
      fail("1 names", `"${id}" resolves to "${actual}", expected "${expected}"`);
    } else ok();
  }

  // Every offered platform must resolve to something other than its own id,
  // or a new entry has silently fallen through to the title-case fallback.
  for (const id of MESH_PLATFORM_IDS) {
    if (getDisplayNameForAnyPlatform(id).toLowerCase() === id.toLowerCase()) {
      // Equal-ignoring-case is fine when the name genuinely IS the id
      // capitalized (Reddit, Twitch). Only a VERBATIM match is a failure —
      // that means the raw storage key reached the screen.
      if (getDisplayNameForAnyPlatform(id) === id) {
        fail("1 names", `"${id}" resolves to the bare storage key`);
        continue;
      }
    }
    ok();
  }
}

// ── 2. Retired platforms keep their names ───────────────────────────────────
//
// Retiring a platform does not delete anyone's ConnectedAccount rows, so these
// still reach the screen on the One Account page. They were rendering as raw
// ids, which is what made a real connection look like a bug.
{
  const RETIRED: Record<string, string> = {
    spotify: "Spotify",
    github: "GitHub",
    soundcloud: "SoundCloud",
    whatsapp: "WhatsApp",
    kakao: "KakaoTalk",
  };
  for (const [id, expected] of Object.entries(RETIRED)) {
    const actual = getDisplayNameForAnyPlatform(id);
    if (actual !== expected) {
      fail("2 retired", `retired "${id}" resolves to "${actual}", expected "${expected}" — a real account still shows this`);
    } else ok();
  }
}

// ── 3. No surface reconstructs a platform name on its own ───────────────────
//
// `capitalize` next to a platform id is the exact pattern that produced
// "Tiktok". Anything that wants a name calls the one function.
{
  const SURFACES = [
    "src/components/settings/settings-control-center.tsx",
    "src/components/privacy/privacy-control-center.tsx",
    "src/components/analytics/privacy-permissions-manager.tsx",
    "src/app/(app)/profile/profile-view.tsx",
    "src/app/(app)/search/search-client.tsx",
    "src/app/(app)/feed/[postId]/external-post-detail.tsx",
    "src/components/messages/mechat-conversation-list.tsx",
    "src/components/feed/post-card.tsx",
  ];

  // A raw id rendered inside a capitalize-d element: `capitalize ...>{x.platform}`
  const CAPITALIZED_ID = /capitalize[^>]*>\s*\{[^}]*\.platform\}/;
  // A hand-rolled "uppercase the first letter of the id" reconstruction.
  const HAND_ROLLED = /\.platform(?:Name)?[^\n]{0,40}charAt\(0\)\.toUpperCase\(\)/;

  for (const file of SURFACES) {
    let body: string;
    try {
      body = read(file);
    } catch {
      fail("3 one source", `${file} is gone; this gate has lost one of its subjects`);
      continue;
    }
    if (CAPITALIZED_ID.test(body)) {
      fail("3 one source", `${file} renders a raw platform id under a CSS \`capitalize\` — that spells TikTok "Tiktok". Call getDisplayNameForAnyPlatform.`);
    } else ok();
    if (HAND_ROLLED.test(body)) {
      fail("3 one source", `${file} rebuilds a platform name with charAt(0).toUpperCase() instead of reading the one table`);
    } else ok();
  }
}

// ── 4. The badge map states pigments, not names ─────────────────────────────
//
// PLATFORM_BADGE in the feed card owns brand colors and two-letter marks, which
// nothing else owns. It used to carry `label` as well, which made it the fifth
// place stating what a platform is called.
{
  const body = read("src/components/feed/post-card.tsx");
  const decl = /const PLATFORM_BADGE: Record<string, \{([^}]*)\}>/.exec(body);
  if (!decl) {
    fail("4 badge map", "PLATFORM_BADGE's declaration changed shape; this gate can no longer read it");
  } else if (/\blabel\b/.test(decl[1])) {
    fail("4 badge map", "PLATFORM_BADGE carries a `label` again — the name belongs to lib/platform-capabilities, not to a color table");
  } else ok();
}

if (failures.length) {
  console.error(`\nplatform-name: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `platform-name OK — ${checks} assertions. One table names every platform: the ids that CSS \`capitalize\`\n` +
    "  spells wrong (TikTok, LinkedIn, YouTube, and X — which it spells \"Twitter\", contradicting the product's\n" +
    "  own list) all resolve correctly, retired platforms still reaching real users' cards keep their names,\n" +
    "  no listed surface reconstructs a name from a raw id, and the feed badge map states pigments only.\n" +
    "  Does NOT cover: whether a name is right — a platform added to the allow-list misspelled passes here\n" +
    "  and is then wrong everywhere at once, which is the trade for one source instead of five.",
);
