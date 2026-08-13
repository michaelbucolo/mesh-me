// The room roster — presence-client's bookkeeping half: who is in the room,
// with the hysteresis grace that keeps serverless payload jitter from
// blinking Meshis in and out, join/leave detection as discrete events, and
// the per-user appearance signatures behind per-Meshi memoization.
//
// Pure and zero-DOM (exercised by scripts/mesh-live-contract.ts): payloads
// and sweep ticks go in, `RosterEvents` come out. The React hook maps those
// events to state and moments; sprites/world effects live elsewhere.

/** One person's presence as the room payload delivers it. */
export type RemotePresence = {
  userId: string;
  username: string;
  displayName: string;
  meshiColor: string;
  meshiHat: string;
  meshiHair?: string;
  meshiHairColor?: string;
  meshiAccessory?: string;
  meshiEyeStyle?: string;
  meshiBadge?: string;
  meshiOutfit?: string;
  meshiMood: string;
  viewportPosition: { vx: number; vy: number };
  position?: { x: number; y: number };
  viewingMesh: string;
  surface?: string;
  /** The node this person is reading right now — their Meshi stands at it. */
  activeNodeId?: string | null;
  /** Encoded tiny world action (see live/action-bus) to replay in the room. */
  lastAction?: string | null;
  /** Where on mesh.me they are when not on a mesh surface (e.g. "/flow"). */
  activeRoute?: string | null;
  /** MeshPro member — their Meshi carries a subtle gold aura. */
  isPro?: boolean;
  isOnline: boolean;
};

/** Presence hysteresis: a Meshi only LEAVES once it's been absent this long,
 * so a single dropped payload (poll and stream landing on different
 * serverless instances, or a reconnect onto a cold instance) can't make the
 * room blink. Sightings register instantly; only sustained absence removes. */
export const PRESENCE_GRACE_MS = 4500;

export interface RoomRoster {
  /** userId → last accepted entry. Object identity is stable while the
   * user's appearance signature is unchanged — THE property per-Meshi
   * memoization keys on. */
  entries: Map<string, RemotePresence>;
  seenAt: Map<string, number>;
  sig: Map<string, string>;
  /** Whole-roster signature (membership + appearances). */
  roomSig: string;
  /** Null until the first payload — the baseline; no join events before it. */
  prevIds: Set<string> | null;
}

export function createRoster(): RoomRoster {
  return { entries: new Map(), seenAt: new Map(), sig: new Map(), roomSig: "", prevIds: null };
}

/** Everything the layer renders from — re-render only when this changes. */
function appearanceSignature(p: RemotePresence): string {
  return `${p.userId}:${p.meshiColor}:${p.meshiHat}:${p.meshiHair}:${p.meshiHairColor}:${p.meshiAccessory}:${p.meshiEyeStyle}:${p.meshiBadge}:${p.meshiOutfit}:${p.meshiMood}:${p.isPro ? 1 : 0}:${p.username}`;
}

export interface RosterEvents {
  /** Users newly in the room (after the baseline payload). */
  joined: RemotePresence[];
  /** Users whose grace expired this pass — capture their fade-out spot
   * BEFORE forgetting their sprite. */
  left: RemotePresence[];
  /** The room as of this pass: fresh sightings + still-in-grace stragglers. */
  effective: RemotePresence[];
  /** True when membership or someone's appearance changed — the ONLY reason
   * to touch React state. */
  changed: boolean;
}

/** Record fresh sightings. Callers pass the payload's in-room entries; grace
 * expiry is applied in the same pass (payloads double as sweeps). */
export function applySightings(
  roster: RoomRoster,
  visible: RemotePresence[],
  now: number,
): RosterEvents {
  for (const p of visible) {
    roster.seenAt.set(p.userId, now);
    const sig = appearanceSignature(p);
    if (roster.sig.get(p.userId) !== sig) {
      // Appearance changed (or new) — adopt the fresh object.
      roster.sig.set(p.userId, sig);
      roster.entries.set(p.userId, p);
    }
    // else: keep the existing object so its identity stays stable —
    // positions ride the sprite machine, never this object.
  }
  return sweepRoster(roster, now);
}

/** Grace expiry + join/leave/change detection. Runs on every payload AND on
 * the hook's own sweep timer, so a leaver fades on time even when the
 * transport has gone quiet (the old code only noticed on the next payload).
 *
 * `lastPayloadAt` is the EVIDENCE gate for the standalone sweep: a member is
 * evicted only when a delivered payload OMITTED them (their seenAt predates
 * the last payload) and the grace then expired. Both the server stream and
 * the client transport dedupe byte-identical payloads, so a payload-static
 * room (everyone parked reading — position/mood/perch frozen) legitimately
 * delivers ZERO frames while every member is still heartbeating; absence of
 * traffic is NOT absence of people, and evicting on it would flap idle
 * members out (leave fade + sound) and replay their join moment (chime,
 * "entered your mesh" toast, arrive burst) on their next move. Any REAL
 * leave changes the room payload, which always produces a frame — so gating
 * on payload evidence never delays a genuine departure. Defaults to `now`
 * (payload calls: the payload itself is the evidence), preserving the
 * payload-path behaviour exactly. */
export function sweepRoster(
  roster: RoomRoster,
  now: number,
  lastPayloadAt: number = now,
): RosterEvents {
  const effective: RemotePresence[] = [];
  const left: RemotePresence[] = [];
  roster.seenAt.forEach((seenAt, id) => {
    const entry = roster.entries.get(id);
    if (!entry) {
      roster.seenAt.delete(id);
      return;
    }
    if (now - seenAt > PRESENCE_GRACE_MS && lastPayloadAt > seenAt) {
      roster.seenAt.delete(id);
      roster.entries.delete(id);
      roster.sig.delete(id);
      left.push(entry);
      return;
    }
    effective.push(entry);
  });

  const joined: RemotePresence[] = [];
  const ids = new Set<string>();
  for (const p of effective) ids.add(p.userId);
  if (roster.prevIds) {
    for (const p of effective) {
      if (!roster.prevIds.has(p.userId)) joined.push(p);
    }
  }
  roster.prevIds = ids;

  const roomSig = effective
    .map((p) => roster.sig.get(p.userId) ?? "")
    .sort()
    .join("|");
  const changed = roomSig !== roster.roomSig;
  roster.roomSig = roomSig;

  return { joined, left, effective, changed };
}

/** Forget everything (room switch) — no phantom visitors carry across. */
export function resetRoster(roster: RoomRoster): void {
  roster.entries.clear();
  roster.seenAt.clear();
  roster.sig.clear();
  roster.roomSig = "";
  roster.prevIds = null;
}
