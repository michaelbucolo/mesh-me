// Small, opt-in expressions grounded in people actually visible in this room.
// This policy never invents a participant, a reply, or an interaction history.

import type { MeshiMood } from "@/components/meshi/meshi-mascot";

interface RoomMomentState {
  roomId: string | null;
  arrivalSent: boolean;
  visibleSince: number | null;
  nearId: string | null;
  nearSince: number;
  idlePlayed: boolean;
  mood: MeshiMood | null;
  moodUntil: number;
}

export function createRoomMomentState(): RoomMomentState {
  return { roomId: null, arrivalSent: false, visibleSince: null, nearId: null, nearSince: 0, idlePlayed: false, mood: null, moodUntil: 0 };
}

interface RoomMomentInput {
  now: number;
  roomId: string | null;
  enabled: boolean;
  visible: boolean;
  ghost: boolean;
  activityHidden: boolean;
  reducedMotion: boolean;
  busy: boolean;
  idleForMs: number;
  /** Only authorized, online, in-room people currently inside the viewport. */
  peers: ReadonlyArray<{ id: string; distancePx: number }>;
}

export function stepRoomMoment(state: RoomMomentState, input: RoomMomentInput): { wave: boolean; mood: MeshiMood | null } {
  if (state.roomId !== input.roomId) Object.assign(state, createRoomMomentState(), { roomId: input.roomId });
  const allowed = Boolean(input.roomId) && input.enabled && input.visible && !input.ghost && !input.activityHidden && !input.reducedMotion;
  if (!allowed || input.busy) {
    state.visibleSince = null;
    state.nearId = null;
    state.mood = null;
    state.moodUntil = 0;
    return { wave: false, mood: null };
  }
  if (input.idleForMs < 1000) state.idlePlayed = false;
  if (input.idleForMs >= 45000) return { wave: false, mood: "sleepy" };

  const nearest = [...input.peers]
    .filter((peer) => peer.id && Number.isFinite(peer.distancePx) && peer.distancePx >= 0)
    .sort((a, b) => a.distancePx - b.distancePx || a.id.localeCompare(b.id))[0];
  if (!nearest) {
    state.visibleSince = null;
    state.nearId = null;
    state.mood = null;
    state.moodUntil = 0;
    return { wave: false, mood: null };
  }
  if (state.visibleSince === null) state.visibleSince = input.now;
  if (!state.arrivalSent && input.now - state.visibleSince >= 1200) {
    state.arrivalSent = true;
    state.mood = "happy";
    state.moodUntil = input.now + 1800;
    return { wave: true, mood: state.mood };
  }

  // A brief wink after settling near somebody. One per idle spell, never a
  // recurring expression cycle, and never a fabricated response from them.
  if (nearest.distancePx <= 140) {
    if (state.nearId !== nearest.id) {
      state.nearId = nearest.id;
      state.nearSince = input.now;
    }
    if (!state.idlePlayed && input.idleForMs >= 12000 && input.now - state.nearSince >= 1600 && input.now >= state.moodUntil) {
      state.idlePlayed = true;
      state.mood = "wink";
      state.moodUntil = input.now + 1600;
    }
  } else state.nearId = null;
  if (input.now >= state.moodUntil) state.mood = null;
  return { wave: false, mood: state.mood };
}
