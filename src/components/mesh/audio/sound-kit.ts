// The mesh's fun-sound gate over the ONE existing platform sound kit
// (src/lib/sound.ts).
//
// The platform has a single persisted preference (`meshSoundsEnabled`,
// surfaced as the Sounds toggle in Settings) and that is the only control:
// the playful sounds the mesh makes — an emote pop, a heart landing — follow
// it exactly like every other sound in the app. There is no second toggle and
// no separate opt-in prompt to dismiss.
//
// The mesh does not play music. Strumming a strand is a visual and physical
// event only; it makes no tone.
//
// All synthesis rides the existing kit: zero new assets, nothing allocated
// while muted, and none of it is affected by prefers-reduced-motion (sound is
// not motion).

import { isSoundEnabled, playSound, type SoundName } from "@/lib/sound";

/** A playful mesh sound — follows the one platform sound preference. */
export function playFunSound(name: SoundName): void {
  if (!isSoundEnabled()) return;
  playSound(name);
}
