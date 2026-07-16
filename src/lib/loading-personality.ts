type LoadingPersonalityMode =
  | "default"
  | "mesh-building"
  | "message-writing"
  | "secure"
  | "search"
  | "social"
  | "creator";

export interface LoadingPersonality {
  title: string;
  subtitle: string;
  mode: LoadingPersonalityMode;
  progressLabel: string;
  steps: readonly string[];
  ariaLabel?: string;
}

const loadingPersonalities = {
  public: {
    title: "Opening Mesh.me",
    subtitle: "Meshi is preparing a calm way into your world.",
    mode: "default",
    progressLabel: "Signal ready",
    steps: ["Starting the interface", "Warming the Mesh", "Preparing secure entry", "Bringing the page into view"],
    ariaLabel: "Loading Mesh.me",
  },
  app: {
    title: "Opening your world",
    subtitle: "Meshi is connecting the next part of your Mesh.",
    mode: "default",
    progressLabel: "Workspace ready",
    steps: ["Checking your session", "Loading your workspace", "Preparing live signals", "Finishing the handoff"],
    ariaLabel: "Loading your Mesh.me workspace",
  },
  communities: {
    title: "Communities",
    subtitle: "Meshi is preparing your shared spaces.",
    mode: "social",
    progressLabel: "Spaces loaded",
    steps: ["Fetching joined communities", "Loading active spaces", "Syncing membership state", "Preparing discussions"],
  },
  "connected-accounts": {
    title: "Connections",
    subtitle: "Meshi is checking your linked platforms safely.",
    mode: "secure",
    progressLabel: "Accounts checked",
    steps: ["Loading linked platforms", "Verifying token health", "Reading sync status", "Preparing controls"],
  },
  "content-hub": {
    title: "Content Hub",
    subtitle: "Meshi is assembling your publishing workspace.",
    mode: "creator",
    progressLabel: "Assets staged",
    steps: ["Fetching drafts and assets", "Loading publishing tools", "Syncing scheduled posts", "Preparing analytics"],
  },
  explore: {
    title: "Explore",
    subtitle: "Meshi is finding fresh people, posts, and communities.",
    mode: "search",
    progressLabel: "Discoveries ready",
    steps: ["Collecting discovery signals", "Ranking creators", "Loading conversations", "Assembling modules"],
  },
  feed: {
    title: "Feed",
    subtitle: "Meshi is preparing the next posts for smooth scrolling.",
    mode: "social",
    progressLabel: "Posts loaded",
    steps: ["Fetching latest posts", "Loading media previews", "Syncing reactions", "Keeping your place"],
  },
  innovation: {
    title: "Innovation",
    subtitle: "Meshi is staging the build workspace.",
    mode: "creator",
    progressLabel: "Workspace ready",
    steps: ["Loading briefs", "Fetching updates", "Syncing collaborator notes", "Preparing launch checks"],
  },
  mesh: {
    title: "Your Mesh",
    subtitle: "Meshi is arranging your digital footprint into view.",
    mode: "mesh-building",
    progressLabel: "Nodes linked",
    steps: ["Loading core nodes", "Calculating connections", "Applying filters", "Rendering the network"],
  },
  meshpro: {
    title: "Mesh Pro",
    subtitle: "Meshi is activating your Pro tools.",
    mode: "creator",
    progressLabel: "Tools ready",
    steps: ["Checking Pro access", "Loading Pro dashboards", "Syncing custom visuals", "Preparing advanced insights"],
  },
  messages: {
    title: "MeChat",
    subtitle: "Meshi is organizing your conversations.",
    mode: "message-writing",
    progressLabel: "Threads synced",
    steps: ["Authenticating inbox", "Loading threads", "Hydrating drafts", "Syncing unread counts"],
  },
  notifications: {
    title: "Alerts",
    subtitle: "Meshi is grouping what needs your attention.",
    mode: "secure",
    progressLabel: "Alerts updated",
    steps: ["Fetching recent alerts", "Grouping by priority", "Syncing read state", "Preparing the alert feed"],
  },
  profile: {
    title: "Profile",
    subtitle: "Meshi is preparing identity details.",
    mode: "social",
    progressLabel: "Profile loaded",
    steps: ["Fetching the header", "Loading activity", "Syncing connections", "Preparing profile modules"],
  },
  search: {
    title: "Search",
    subtitle: "Meshi is searching people, posts, chats, and connected content.",
    mode: "search",
    progressLabel: "Results prepared",
    steps: ["Reading your query", "Searching indexes", "Ranking relevance", "Preparing result cards"],
  },
  settings: {
    title: "Settings",
    subtitle: "Meshi is loading privacy, security, and account controls.",
    mode: "secure",
    progressLabel: "Controls loaded",
    steps: ["Fetching preferences", "Loading privacy controls", "Syncing notification rules", "Preparing customization"],
  },
} as const satisfies Record<string, LoadingPersonality>;

export type LoadingPersonalityKey = keyof typeof loadingPersonalities;

export function getLoadingPersonality(key: LoadingPersonalityKey = "app"): LoadingPersonality {
  return loadingPersonalities[key] ?? loadingPersonalities.app;
}
