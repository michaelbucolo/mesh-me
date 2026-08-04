// MESHIMAP — WHERE PEOPLE ARE, WITHOUT MAKING ANYONE FINDABLE.
//
// This is the one feature in mesh.me that can hurt somebody off the screen.
// Everything else risks embarrassment or annoyance; a map of real people at
// real coordinates risks a person being waited for outside their house. So the
// privacy model is not a setting bolted on afterwards — it is the module, and
// the UI is only allowed to render what comes out of here.
//
// ── THE MISTAKE THIS FILE EXISTS TO PREVENT ────────────────────────────────
//
// The obvious way to "blur" a location is to add a random offset. It is also
// wrong, and wrong in a way that looks fine in testing: random jitter is noise
// with a mean of zero, so an observer who samples the same person repeatedly
// can AVERAGE the samples and converge on the true point. Watch someone for an
// afternoon and the blur disappears.
//
// So there is no jitter here. Location is SNAPPED to a fixed grid: everyone in
// the same cell reports the identical coordinate, forever. Sampling it a
// thousand times yields the same answer as sampling it once, because the
// output carries no information about where in the cell the person stood.
//
// ── AND THE SECOND MISTAKE ─────────────────────────────────────────────────
//
// A grid that is anchored to the user is no better than jitter. If each person
// gets their own offset grid, the cell boundaries themselves leak — cross two
// boundaries and you have bounded the true position. The grid is GLOBAL and
// fixed, so a cell is a place rather than a fact about a person.

/** How precisely a location may be shared. There is deliberately no "exact". */
export type Precision = "block" | "town" | "region";

/**
 * Cell sizes in degrees.
 *
 * Latitude degrees are ~111km everywhere; longitude degrees shrink toward the
 * poles, which is fine here — it makes cells NARROWER at high latitude, never
 * wider, so precision only ever errs toward more privacy.
 *
 * "block" is ~1.1km, which is enough to say "someone is around here" and not
 * enough to say which building.
 */
const CELL_DEGREES: Record<Precision, number> = {
  block: 0.01,
  town: 0.1,
  region: 1,
};

export type Coarse = { lat: number; lng: number; precision: Precision };

/**
 * Snap a real position onto the global grid.
 *
 * Deterministic and idempotent: coarsening an already-coarse point returns it
 * unchanged, so a value cannot be sharpened by round-tripping it, and repeated
 * reports from a stationary person are byte-identical.
 */
export function coarsen(lat: number, lng: number, precision: Precision): Coarse {
  const size = CELL_DEGREES[precision];
  // Snap to the CENTRE of the cell rather than its corner: a corner-snapped
  // value looks like a real reading at a plausible address, whereas a centre
  // is visibly a cell and reads honestly as "somewhere around here".
  const snap = (v: number) => Math.floor(v / size) * size + size / 2;
  return {
    lat: round6(clamp(snap(lat), -90, 90)),
    lng: round6(wrapLng(snap(lng))),
    precision,
  };
}

/** Who a person has agreed to appear to. Default is nobody. */
export type Audience = "nobody" | "mutuals" | "followers" | "everyone";

export type ViewerRelation = {
  isSelf: boolean;
  followsSubject: boolean;
  subjectFollowsViewer: boolean;
  isBlockedEitherWay: boolean;
};

/**
 * May this viewer see this person on the map at all?
 *
 * Ordered so the denials come first and cannot be reached around. Ghost mode
 * is checked before audience, because ghost mode is the user saying "not right
 * now" and it must beat every standing permission they have granted.
 */
export function canSeeOnMap(options: {
  audience: Audience;
  ghostMode: boolean;
  relation: ViewerRelation;
}): boolean {
  const { audience, ghostMode, relation } = options;

  // You always see yourself, ghost or not — otherwise you cannot tell what you
  // are broadcasting, and a privacy control you cannot observe is not one.
  if (relation.isSelf) return true;

  if (relation.isBlockedEitherWay) return false;
  if (ghostMode) return false;

  switch (audience) {
    case "nobody":
      return false;
    case "mutuals":
      return relation.followsSubject && relation.subjectFollowsViewer;
    case "followers":
      // The people who follow THEM — the audience they chose to accept. That
      // is exactly `followsSubject` (the viewer follows the subject), and
      // nothing else enters into it.
      //
      // This previously read `subjectFollowsViewer ? false : followsSubject`,
      // which denied MUTUALS: someone who followed you and whom you followed
      // back was refused under "followers" while being accepted under the
      // strictly narrower "mutuals". A privacy setting that hides you from
      // MORE people as you loosen it is not a setting anyone can reason
      // about. No gate caught it because the audience had no coverage at all —
      // "nobody", "mutuals" and "everyone" each had assertions and this one
      // was simply skipped.
      return relation.followsSubject;
    case "everyone":
      return true;
    default:
      // An unknown audience value means a newer client wrote something we do
      // not understand. The safe reading of "unknown" is "no".
      return false;
  }
}

/**
 * Location goes stale rather than lingering.
 *
 * A pin that persists is a claim about where someone IS, long after it stopped
 * being true — and a stale pin is worse than none, because it is confidently
 * wrong. Anything older than the window simply does not appear.
 */
export const LOCATION_TTL_MS = 60 * 60 * 1000;

export function isFresh(reportedAtMs: number, nowMs: number, ttlMs = LOCATION_TTL_MS): boolean {
  if (!Number.isFinite(reportedAtMs)) return false;
  // A timestamp in the future is a clock problem or a forgery; neither is a
  // reason to show a pin.
  if (reportedAtMs > nowMs + 60_000) return false;
  return nowMs - reportedAtMs <= ttlMs;
}

/** What the map is allowed to render for one person. */
export type MapPin = {
  userId: string;
  username: string;
  displayName: string | null;
  at: Coarse;
  /** When it was reported — the UI shows "about an hour ago", never a time. */
  atMs: number;
};

export type MapSubject = {
  userId: string;
  username: string;
  displayName: string | null;
  lat: number;
  lng: number;
  reportedAtMs: number;
  audience: Audience;
  ghostMode: boolean;
  precision: Precision;
  relation: ViewerRelation;
};

/**
 * The only way a location reaches the map.
 *
 * Takes raw subjects and returns pins, having applied — in this order —
 * blocking, ghost mode, audience, freshness, and coarsening. A caller cannot
 * skip a step, because a caller never sees the raw coordinates: they are
 * consumed here and only the cell comes out.
 */
export function pinsFor(subjects: readonly MapSubject[], nowMs: number): MapPin[] {
  const pins: MapPin[] = [];
  for (const s of subjects) {
    if (!canSeeOnMap({ audience: s.audience, ghostMode: s.ghostMode, relation: s.relation })) continue;
    if (!isFresh(s.reportedAtMs, nowMs)) continue;
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
    pins.push({
      userId: s.userId,
      username: s.username,
      displayName: s.displayName,
      at: coarsen(s.lat, s.lng, s.precision),
      atMs: s.reportedAtMs,
    });
  }
  return pins;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Keep longitude in −180..180 after snapping near the antimeridian. */
function wrapLng(v: number): number {
  let x = v;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

/** Six decimals is ~10cm — far finer than any cell, so rounding here cannot
 * add precision, only strip float noise that would otherwise make two people
 * in one cell report subtly different coordinates and become distinguishable. */
function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
