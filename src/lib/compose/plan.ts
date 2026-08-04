// WRITE ONCE, PUBLISH EVERYWHERE — THE RULES.
//
// Publishing is the half of the promise the platforms actually grant. Every
// major API has a content-publishing endpoint, because a third party pushing
// content INTO them is something they want. (Reading their home feed is the
// half they refuse, which is why mesh.me can be your one composer long before
// it could ever be your one reader.)
//
// ── WHY THE RULES ARE PURE DATA, AND WHY THEY LIVE HERE ────────────────────
//
// Each platform refuses a post for its own reasons: Instagram will not take a
// caption with no image, TikTok will not take anything but video, X counts
// characters differently from Threads. Discovering that AFTER pressing publish
// is the worst possible moment — the post half-lands, some platforms have it
// and some do not, and the person has to go and check each app, which is the
// exact chore mesh.me exists to remove.
//
// So the rules are declared, the plan is computed BEFORE anything is sent, and
// the composer can say "Instagram needs a photo" while you are still typing.
// No network, no database, no React: `scripts/compose-plan-check.ts` runs the
// whole thing on a table of cases.
//
// These limits are the documented public ones at the time of writing. They
// change; when they do, this file changes and its gate changes with it, which
// is the point of having them in one place instead of scattered through a
// submit handler.

/** What a post is made of, before anyone has agreed to take it. */
export type Draft = {
  text: string;
  /** Attached media. Kind matters more than count for most refusals. */
  media: Array<{ kind: "image" | "video" }>;
  /** Some platforms post a titled thing rather than a status. */
  title?: string;
};

export type PlatformRule = {
  platform: string;
  label: string;
  /** Hard character ceiling for the body. */
  maxChars: number;
  /** The post cannot exist without media of this kind. */
  requires?: "image" | "video" | "media";
  /** Most images/videos accepted in one post. */
  maxMedia: number;
  /** A title is mandatory (Reddit, YouTube). */
  needsTitle?: boolean;
  maxTitleChars?: number;
  /** This platform has no "post" concept we can publish to at all. */
  publishable: boolean;
};

/**
 * One row per platform we draw a logo for, INCLUDING the ones that cannot be
 * published to. Silence about Twitch would leave the composer looking like it
 * forgot; `publishable: false` lets the UI say why instead.
 */
export const PLATFORM_RULES: readonly PlatformRule[] = Object.freeze([
  { platform: "mesh", label: "mesh.me", maxChars: 5000, maxMedia: 10, publishable: true },
  { platform: "twitter", label: "X", maxChars: 280, maxMedia: 4, publishable: true },
  { platform: "threads", label: "Threads", maxChars: 500, maxMedia: 10, publishable: true },
  { platform: "bluesky", label: "Bluesky", maxChars: 300, maxMedia: 4, publishable: true },
  { platform: "instagram", label: "Instagram", maxChars: 2200, maxMedia: 10, requires: "media", publishable: true },
  { platform: "tiktok", label: "TikTok", maxChars: 2200, maxMedia: 1, requires: "video", publishable: true },
  { platform: "youtube", label: "YouTube", maxChars: 5000, maxMedia: 1, requires: "video", needsTitle: true, maxTitleChars: 100, publishable: true },
  { platform: "reddit", label: "Reddit", maxChars: 40000, maxMedia: 1, needsTitle: true, maxTitleChars: 300, publishable: true },
  { platform: "facebook", label: "Facebook", maxChars: 63206, maxMedia: 10, publishable: true },
  { platform: "linkedin", label: "LinkedIn", maxChars: 3000, maxMedia: 9, publishable: true },
  // Twitch has channels and streams, not posts. Spotify has no user posting.
  // Saying so is better than quietly omitting them.
  { platform: "twitch", label: "Twitch", maxChars: 0, maxMedia: 0, publishable: false },
  { platform: "spotify", label: "Spotify", maxChars: 0, maxMedia: 0, publishable: false },
]);

export function ruleFor(platform: string): PlatformRule | null {
  return PLATFORM_RULES.find((r) => r.platform === platform) ?? null;
}

/** Why a platform will not take this draft, in words a person can act on. */
type Problem =
  | { kind: "unpublishable"; message: string }
  | { kind: "needs-media"; message: string }
  | { kind: "needs-video"; message: string }
  | { kind: "needs-title"; message: string }
  | { kind: "too-long"; message: string; over: number }
  | { kind: "title-too-long"; message: string; over: number }
  | { kind: "too-much-media"; message: string; over: number }
  | { kind: "empty"; message: string };

type TargetPlan = {
  platform: string;
  label: string;
  /** True when this platform would accept the draft as it stands. */
  ok: boolean;
  problems: Problem[];
  /** Characters left before this platform's ceiling. Negative means over. */
  remaining: number;
};

export type PublishPlan = {
  targets: TargetPlan[];
  /** Targets that would go out right now. */
  ready: string[];
  /** Targets held back, and therefore NOT published. */
  blocked: string[];
  /** True when at least one target would accept it. */
  canPublish: boolean;
};

/**
 * Work out, for each selected platform, whether this draft can go.
 *
 * Deliberately returns a plan for EVERY selected target rather than throwing on
 * the first failure: a person selecting five platforms wants to see all five
 * verdicts at once, not to fix one, press publish, and be told about the next.
 */
export function planPublish(draft: Draft, selected: readonly string[]): PublishPlan {
  const text = draft.text ?? "";
  const trimmed = text.trim();
  const images = draft.media.filter((m) => m.kind === "image").length;
  const videos = draft.media.filter((m) => m.kind === "video").length;
  const mediaCount = draft.media.length;
  const title = (draft.title ?? "").trim();

  const targets: TargetPlan[] = selected.map((platform) => {
    const rule = ruleFor(platform);
    if (!rule) {
      return {
        platform,
        label: platform,
        ok: false,
        problems: [{ kind: "unpublishable", message: `${platform} is not a platform mesh.me can publish to.` }],
        remaining: 0,
      };
    }

    const problems: Problem[] = [];

    if (!rule.publishable) {
      problems.push({
        kind: "unpublishable",
        message: `${rule.label} has no posts to publish to — it is here for what comes IN, not what goes out.`,
      });
    } else {
      // Empty is checked per-platform because "empty" differs: a post with only
      // a photo is fine on Instagram and nothing at all on X.
      if (!trimmed && mediaCount === 0) {
        problems.push({ kind: "empty", message: "Nothing to post yet." });
      }

      if (rule.requires === "media" && mediaCount === 0) {
        problems.push({ kind: "needs-media", message: `${rule.label} needs a photo or video.` });
      }
      if (rule.requires === "video" && videos === 0) {
        problems.push({ kind: "needs-video", message: `${rule.label} only takes video.` });
      }
      if (rule.requires === "image" && images === 0) {
        problems.push({ kind: "needs-media", message: `${rule.label} needs a photo.` });
      }

      if (rule.needsTitle && !title) {
        problems.push({ kind: "needs-title", message: `${rule.label} needs a title.` });
      }
      if (rule.needsTitle && rule.maxTitleChars && title.length > rule.maxTitleChars) {
        problems.push({
          kind: "title-too-long",
          message: `${rule.label} titles stop at ${rule.maxTitleChars}.`,
          over: title.length - rule.maxTitleChars,
        });
      }

      if (text.length > rule.maxChars) {
        problems.push({
          kind: "too-long",
          message: `${text.length - rule.maxChars} over the ${rule.label} limit.`,
          over: text.length - rule.maxChars,
        });
      }

      if (mediaCount > rule.maxMedia) {
        problems.push({
          kind: "too-much-media",
          message: `${rule.label} takes ${rule.maxMedia}${rule.maxMedia === 1 ? " attachment" : " attachments"}.`,
          over: mediaCount - rule.maxMedia,
        });
      }
    }

    return {
      platform,
      label: rule.label,
      ok: problems.length === 0,
      problems,
      remaining: rule.maxChars - text.length,
    };
  });

  const ready = targets.filter((t) => t.ok).map((t) => t.platform);
  const blocked = targets.filter((t) => !t.ok).map((t) => t.platform);

  return { targets, ready, blocked, canPublish: ready.length > 0 };
}

/**
 * The tightest character ceiling across the selected platforms.
 *
 * This is what the composer's counter should show. Counting against the most
 * generous platform would let someone write 400 characters, feel fine, and only
 * then learn that X — the one they cared about — refused it.
 */
export function tightestLimit(selected: readonly string[]): number | null {
  const limits = selected
    .map(ruleFor)
    .filter((r): r is PlatformRule => !!r && r.publishable)
    .map((r) => r.maxChars);
  return limits.length ? Math.min(...limits) : null;
}
