const MESHI_MOODS = [
  "happy",
  "excited",
  "thinking",
  "cool",
  "love",
  "wink",
  "surprised",
  "sleepy",
  "searching",
  "learning",
  "celebrating",
  "blinking",
] as const;

export type MeshiMood = (typeof MESHI_MOODS)[number];

export interface MeshiAction {
  type: string;
  content?: string;
  suggestionType?: string;
  recipient?: string;
  message?: string;
}

export interface MeshiContext {
  meshData?: {
    followers?: number;
    following?: number;
    posts?: number;
    communities?: number;
    platforms?: number;
  };
  meshEntities?: Array<{
    /** The subject's user/community id. The client has always sent it (these are
     *  MeshGraphEntity rows); declaring it is what lets the chat route resolve
     *  each named third party's own Meshi rule before the entity goes upstream. */
    id?: string;
    type: string;
    label: string;
    sublabel?: string;
    isMutual?: boolean;
    followerCount?: number;
    memberCount?: number;
  }>;
  focusedContent?: {
    id?: string;
    platform?: string;
    author?: string;
    text?: string;
    mediaTypes?: string[];
    externalUrl?: string;
    contentRating?: string;
    mediaSignals?: string[];
  };
  currentPage?: string;
}

export interface MeshiHistoryMessage {
  role: "user" | "meshi";
  content: string;
}

export type MeshiSource = "engine" | "database" | "local" | "offline";

export interface MeshiResponse {
  content: string;
  mood: MeshiMood;
  action?: MeshiAction;
  source: MeshiSource;
  model?: string;
  meshi: {
    identity: "mascot-user-vessel";
    engineReady: boolean;
    grounded: boolean;
  };
}

export function normalizeMeshiMood(value: unknown, fallback: MeshiMood = "happy"): MeshiMood {
  if (typeof value === "string" && MESHI_MOODS.includes(value as MeshiMood)) {
    return value as MeshiMood;
  }
  return fallback;
}

export function createMeshiResponse(
  input: {
    content: string;
    mood?: unknown;
    action?: MeshiAction;
    source: MeshiSource;
    model?: string;
    engineReady?: boolean;
    grounded?: boolean;
  },
): MeshiResponse {
  return {
    content: input.content,
    mood: normalizeMeshiMood(input.mood, "thinking"),
    action: input.action,
    source: input.source,
    model: input.model,
    meshi: {
      identity: "mascot-user-vessel",
      engineReady: input.engineReady ?? false,
      grounded: input.grounded ?? false,
    },
  };
}

export function createMeshiOfflineResponse(): MeshiResponse {
  return createMeshiResponse({
    // Not "my private reasoning engine". It is a third-party AI provider, and
    // this is the message shown at the exact moment it could not be reached —
    // "your data stayed protected" implied the protection was the point rather
    // than an accident of the request failing.
    content: "I could not reach the AI provider that generates my replies. Nothing was sent. Try again in a moment.",
    mood: "thinking",
    source: "offline",
    engineReady: false,
    grounded: false,
  });
}
