type LoadingPersonalityMode =
  | "default"
  | "mesh-building"
  | "message-writing"
  | "secure"
  | "search"
  | "social"
  | "creator";

export interface LoadingPersonality {
  /** One short, playful line — the only text a loading screen shows. */
  title: string;
  mode: LoadingPersonalityMode;
  ariaLabel?: string;
}

const loadingPersonalities = {
  public: {
    title: "Opening Mesh.me…",
    mode: "default",
    ariaLabel: "Loading Mesh.me",
  },
  app: {
    title: "One sec…",
    mode: "default",
    ariaLabel: "Loading your Mesh.me workspace",
  },
  communities: {
    title: "Gathering your people…",
    mode: "social",
  },
  "connected-accounts": {
    title: "Checking your connections…",
    mode: "secure",
  },
  explore: {
    title: "Scouting for gems…",
    mode: "search",
  },
  feed: {
    title: "Rolling out the Flow…",
    mode: "social",
  },
  mesh: {
    title: "Weaving your world…",
    mode: "mesh-building",
  },
  meshpro: {
    title: "Polishing the good stuff…",
    mode: "creator",
  },
  messages: {
    title: "Fetching your chats…",
    mode: "message-writing",
  },
  notifications: {
    title: "Rounding up what's new…",
    mode: "secure",
  },
  profile: {
    title: "Setting the stage…",
    mode: "social",
  },
  search: {
    title: "On the hunt…",
    mode: "search",
  },
  settings: {
    title: "Unlocking the controls…",
    mode: "secure",
  },
} as const satisfies Record<string, LoadingPersonality>;

export type LoadingPersonalityKey = keyof typeof loadingPersonalities;

export function getLoadingPersonality(key: LoadingPersonalityKey = "app"): LoadingPersonality {
  return loadingPersonalities[key] ?? loadingPersonalities.app;
}
