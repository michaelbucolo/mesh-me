// The mesh's fun-sound gate — PR7's "sound is OFF by default" policy over
// the ONE existing platform sound kit (src/lib/sound.ts).
//
// The platform already has a single persisted preference (`meshSoundsEnabled`,
// surfaced as the Sounds toggle in Settings). PR7 does NOT add a second
// toggle. Instead, every sound the fun layer introduces (strand strum tones,
// emote pops, flick hearts) is gated on that preference being EXPLICITLY set:
//
//   - preference unset  → fun sounds are silent (off by default, per the
//     blueprint's judge amendment) and the first playful gesture may offer a
//     quiet one-time "Sound on?" affordance;
//   - preference "1"    → fun sounds play (the user opted in, either via the
//     affordance or the Settings toggle);
//   - preference "0"    → silent everywhere, and the affordance never shows.
//
// Accepting the affordance persists through setSoundEnabled(true) — the same
// preference Settings reads — so there is exactly one source of truth.
// Dismissing it only remembers that the offer was declined (the preference
// itself stays untouched, so the rest of the app's sound behavior is
// unchanged). All synthesis rides the existing kit: zero new assets, zero
// buffers allocated while muted, and none of this is affected by
// prefers-reduced-motion (sound is not motion).

import {
  hasSoundPreference,
  isSoundEnabled,
  playSound,
  playStrum,
  setSoundEnabled,
  type SoundName,
} from "@/lib/sound";

const OFFER_DISMISSED_KEY = "mesh-sound-offer-dismissed";

/** Successive strum tones are capped to a musical cadence — a fast sweep
 * across many strands plays a glissando, never a machine-gun. */
const STRUM_TONE_MIN_GAP_MS = 85;
let lastStrumToneAt = 0;

/** Fun sounds require an explicit opt-in: the one preference, explicitly set. */
export function funSoundsEnabled(): boolean {
  return hasSoundPreference() && isSoundEnabled();
}

/** Should the one-time "Sound on?" affordance be offered right now? Only
 * while the user has never chosen (no preference) and never dismissed it. */
export function shouldOfferSoundOptIn(): boolean {
  if (typeof window === "undefined") return false;
  if (hasSoundPreference()) return false;
  try {
    return localStorage.getItem(OFFER_DISMISSED_KEY) === null;
  } catch {
    return false;
  }
}

/** "Sound on" — persist the choice through the ONE existing preference. */
export function acceptSoundOptIn(): void {
  setSoundEnabled(true);
  // A tiny immediate confirmation so the choice is audible right away.
  playSound("pop");
}

/** "Keep it quiet" — remember the dismissal; the preference stays unset so
 * nothing else about the app's sound behavior changes. */
export function declineSoundOptIn(): void {
  try {
    localStorage.setItem(OFFER_DISMISSED_KEY, "1");
  } catch {
    // Storage may be unavailable; the offer simply may reappear next visit.
  }
}

/** A fun-layer sound: plays only after the explicit opt-in. */
export function playFunSound(name: SoundName): void {
  if (!funSoundsEnabled()) return;
  playSound(name);
}

/** A strand strum's pentatonic tone (degree 0 = lowest), opt-in gated and
 * rate-capped to the musical cadence above. */
export function playStrumTone(degree: number): void {
  if (!funSoundsEnabled()) return;
  const now = Date.now();
  if (now - lastStrumToneAt < STRUM_TONE_MIN_GAP_MS) return;
  lastStrumToneAt = now;
  playStrum(degree);
}
