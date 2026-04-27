export type MeshPlatform =
  | "mesh"
  | "youtube"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "x"
  | "threads"
  | "discord"
  | "twitch"
  | "spotify"
  | "github"
  | "reddit";

export type MeshVisibility = "private" | "trusted" | "friends" | "public";

export type MeshNodeKind =
  | "self"
  | "persona"
  | "account"
  | "post"
  | "person"
  | "group"
  | "comment"
  | "place"
  | "moment"
  | "topic"
  | "message";

export type MeshNodeRecord = {
  id: string;
  label: string;
  kind: MeshNodeKind;
  platform: MeshPlatform;
  visibility: MeshVisibility;
  description: string;
  x: number;
  y: number;
  radius: number;
  accent: string;
  stats?: Record<string, number | string>;
  tags?: string[];
  personaId?: string;
};

export type MeshEdgeRecord = {
  id: string;
  from: string;
  to: string;
  label: string;
  strength: number;
  visibility: MeshVisibility;
};

export type MeshIdentity = {
  id: string;
  displayName: string;
  handle: string;
  publicPersona: string;
  privateSummary: string;
};

export type MeshQuestionResult = {
  answer: string;
  sources: string[];
  confidence: "demo" | "low" | "medium" | "high";
  privacyNote: string;
  actions: string[];
};

export const meshIdentity: MeshIdentity = {
  id: "john",
  displayName: "John",
  handle: "@john",
  publicPersona: "MediaMan",
  privateSummary: "John controls what stays private, what is shared with trusted friends, and what becomes part of MediaMan's public creator graph.",
};

export const platformNames: Record<MeshPlatform, string> = {
  mesh: "Mesh.me",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  threads: "Threads",
  discord: "Discord",
  twitch: "Twitch",
  spotify: "Spotify",
  github: "GitHub",
  reddit: "Reddit",
};

export const meshNodes: MeshNodeRecord[] = [
  {
    id: "john",
    label: "John",
    kind: "self",
    platform: "mesh",
    visibility: "private",
    description: "The private owner node. This is the user's true control center, not an ad profile.",
    x: 50,
    y: 50,
    radius: 44,
    accent: "#60a5fa",
    stats: { accounts: 9, posts: 1842, people: 438, sightings: 37 },
    tags: ["identity", "private", "control"],
  },
  {
    id: "mediaman",
    label: "MediaMan",
    kind: "persona",
    platform: "mesh",
    visibility: "public",
    description: "John's public internet persona with its own accounts, audience, posts, and presence.",
    x: 67,
    y: 32,
    radius: 33,
    accent: "#a78bfa",
    stats: { reach: "1.2M", posts: 312, collaborators: 28 },
    tags: ["creator", "public", "persona"],
  },
  {
    id: "youtube-main",
    label: "YouTube Channel",
    kind: "account",
    platform: "youtube",
    visibility: "public",
    description: "Long-form videos, Shorts, comments, subscribers, channel analytics, and creator collaborations.",
    x: 77,
    y: 48,
    radius: 25,
    accent: "#ef4444",
    personaId: "mediaman",
    stats: { subscribers: "482K", videos: 126, comments: "18K" },
    tags: ["video", "creator", "analytics"],
  },
  {
    id: "instagram-public",
    label: "Instagram Creator",
    kind: "account",
    platform: "instagram",
    visibility: "public",
    description: "Reels, stories, tagged posts, comments, close-friends boundaries, and visual identity.",
    x: 65,
    y: 68,
    radius: 23,
    accent: "#ec4899",
    personaId: "mediaman",
    stats: { followers: "218K", reels: 224, tagged: 31 },
    tags: ["reels", "stories", "tags"],
  },
  {
    id: "tiktok-public",
    label: "TikTok",
    kind: "account",
    platform: "tiktok",
    visibility: "public",
    description: "Short-form posts, stitches, sounds, trends, comments, and creator discovery.",
    x: 87,
    y: 30,
    radius: 21,
    accent: "#22d3ee",
    personaId: "mediaman",
    stats: { followers: "164K", videos: 383, sounds: 12 },
    tags: ["shorts", "trends", "discovery"],
  },
  {
    id: "facebook-personal",
    label: "Facebook Personal",
    kind: "account",
    platform: "facebook",
    visibility: "friends",
    description: "Personal friends, family posts, tagged albums, events, memories, and groups.",
    x: 30,
    y: 33,
    radius: 22,
    accent: "#3b82f6",
    stats: { friends: 646, groups: 19, memories: 206 },
    tags: ["personal", "family", "events"],
  },
  {
    id: "instagram-personal",
    label: "Instagram Personal",
    kind: "account",
    platform: "instagram",
    visibility: "trusted",
    description: "Private stories, friends, tagged photos, memories, and close-friends content.",
    x: 35,
    y: 69,
    radius: 21,
    accent: "#f472b6",
    stats: { followers: 832, closeFriends: 54, tagged: 88 },
    tags: ["private", "friends", "photos"],
  },
  {
    id: "stephen",
    label: "Stephen",
    kind: "person",
    platform: "mesh",
    visibility: "trusted",
    description: "Trusted friend and frequent collaborator. Meshi can deliver messages to Stephen's Meshi when allowed.",
    x: 18,
    y: 51,
    radius: 26,
    accent: "#34d399",
    stats: { postsTogether: 14, messages: 921, mutuals: 64 },
    tags: ["trusted", "collaborator", "friend"],
  },
  {
    id: "jacob",
    label: "Jacob",
    kind: "person",
    platform: "mesh",
    visibility: "friends",
    description: "A followed person. Meshi can answer questions only from public or permissioned context.",
    x: 24,
    y: 80,
    radius: 20,
    accent: "#fbbf24",
    stats: { publicTrips: 3, postsTogether: 2, mutuals: 18 },
    tags: ["friend", "travel", "context"],
  },
  {
    id: "france-trip",
    label: "France Trip",
    kind: "place",
    platform: "instagram",
    visibility: "public",
    description: "A public post cluster tagged in Paris and Nice. Meshi can cite this when asked if Jacob has been to France.",
    x: 10,
    y: 84,
    radius: 15,
    accent: "#fde68a",
    stats: { posts: 6, seenPeople: 4, year: 2024 },
    tags: ["France", "Paris", "travel"],
  },
  {
    id: "found-in-posts",
    label: "Seen in Posts",
    kind: "moment",
    platform: "mesh",
    visibility: "private",
    description: "A private recognition index showing how often John appears in imported photos and videos.",
    x: 50,
    y: 87,
    radius: 20,
    accent: "#38bdf8",
    stats: { totalSightings: 37, publicSightings: 19, privateSightings: 18 },
    tags: ["recognition", "privacy", "photos"],
  },
  {
    id: "launch-post",
    label: "Launch Post",
    kind: "post",
    platform: "youtube",
    visibility: "public",
    description: "A creator announcement post connected to comments, remixes, messages, and analytics.",
    x: 89,
    y: 62,
    radius: 17,
    accent: "#fb7185",
    personaId: "mediaman",
    stats: { views: "2.4M", comments: "8.8K", reposts: 742 },
    tags: ["launch", "video", "analytics"],
  },
  {
    id: "creator-group",
    label: "Creator Group",
    kind: "group",
    platform: "discord",
    visibility: "trusted",
    description: "A private group connected to shared posts, calls, messages, and collaborative projects.",
    x: 82,
    y: 82,
    radius: 19,
    accent: "#818cf8",
    stats: { members: 11, channels: 6, activeToday: 7 },
    tags: ["group", "discord", "trusted"],
  },
  {
    id: "privacy-vault",
    label: "Privacy Vault",
    kind: "topic",
    platform: "mesh",
    visibility: "private",
    description: "Permission controls, encryption status, audit logs, deletion controls, and API access history.",
    x: 13,
    y: 20,
    radius: 19,
    accent: "#93c5fd",
    stats: { permissions: 42, revoked: 9, encrypted: "100%" },
    tags: ["security", "permissions", "audit"],
  },
  {
    id: "message-stephen",
    label: "Message to Stephen",
    kind: "message",
    platform: "mesh",
    visibility: "trusted",
    description: "A Meshi-to-Meshi delivery request. The message is encrypted and routed to Stephen's Meshi.",
    x: 8,
    y: 61,
    radius: 13,
    accent: "#86efac",
    stats: { delivered: "ready", encryption: "E2EE" },
    tags: ["MeChat", "delivery", "encrypted"],
  },
];

export const meshEdges: MeshEdgeRecord[] = [
  { id: "john-mediaman", from: "john", to: "mediaman", label: "internet persona", strength: 92, visibility: "private" },
  { id: "john-facebook", from: "john", to: "facebook-personal", label: "personal account", strength: 79, visibility: "friends" },
  { id: "john-instagram-personal", from: "john", to: "instagram-personal", label: "private account", strength: 86, visibility: "trusted" },
  { id: "john-stephen", from: "john", to: "stephen", label: "trusted friend", strength: 96, visibility: "trusted" },
  { id: "john-jacob", from: "john", to: "jacob", label: "following", strength: 58, visibility: "friends" },
  { id: "john-seen", from: "john", to: "found-in-posts", label: "appears in", strength: 74, visibility: "private" },
  { id: "john-vault", from: "john", to: "privacy-vault", label: "controls", strength: 100, visibility: "private" },
  { id: "mediaman-youtube", from: "mediaman", to: "youtube-main", label: "public channel", strength: 94, visibility: "public" },
  { id: "mediaman-instagram", from: "mediaman", to: "instagram-public", label: "public creator acct", strength: 88, visibility: "public" },
  { id: "mediaman-tiktok", from: "mediaman", to: "tiktok-public", label: "short-form acct", strength: 82, visibility: "public" },
  { id: "youtube-launch", from: "youtube-main", to: "launch-post", label: "published", strength: 86, visibility: "public" },
  { id: "launch-group", from: "launch-post", to: "creator-group", label: "discussed by", strength: 64, visibility: "trusted" },
  { id: "stephen-group", from: "stephen", to: "creator-group", label: "member", strength: 76, visibility: "trusted" },
  { id: "stephen-message", from: "stephen", to: "message-stephen", label: "Meshi route", strength: 90, visibility: "trusted" },
  { id: "jacob-france", from: "jacob", to: "france-trip", label: "visited", strength: 72, visibility: "public" },
  { id: "instagram-seen", from: "instagram-personal", to: "found-in-posts", label: "tagged media", strength: 65, visibility: "private" },
  { id: "facebook-seen", from: "facebook-personal", to: "found-in-posts", label: "albums", strength: 59, visibility: "friends" },
  { id: "vault-accounts", from: "privacy-vault", to: "youtube-main", label: "permission scope", strength: 75, visibility: "private" },
  { id: "vault-private-ig", from: "privacy-vault", to: "instagram-personal", label: "permission scope", strength: 88, visibility: "private" },
];

export const meshFeed = [
  {
    id: "f1",
    platform: "youtube" as MeshPlatform,
    title: "MediaMan posted a new launch video",
    body: "2.4M views, 8.8K comments, 742 reposts. Routed into John -> MediaMan -> YouTube Channel -> Launch Post.",
    privacy: "Public creator content",
  },
  {
    id: "f2",
    platform: "instagram" as MeshPlatform,
    title: "John was tagged in a birthday post",
    body: "This appears in the private Seen in Posts branch until John chooses who can view it.",
    privacy: "Private by default",
  },
  {
    id: "f3",
    platform: "discord" as MeshPlatform,
    title: "Creator Group is active",
    body: "Seven trusted collaborators are online. Meshi can summarize the shared project thread.",
    privacy: "Trusted circle",
  },
  {
    id: "f4",
    platform: "mesh" as MeshPlatform,
    title: "Meshi detected a duplicate identity",
    body: "MediaMan and John share verified ownership but keep separate public and personal surfaces.",
    privacy: "Transparent identity link",
  },
];

export const trustStack = [
  "No selling user data",
  "Private by default for imported personal content",
  "User-owned visibility controls per account, branch, post, and interaction",
  "Encrypted credential storage and revocable platform permissions",
  "Transparent activity logs for every sync, import, export, and AI lookup",
  "Meshi answers from indexed context and reports what it used",
  "Bot resistance through verification, behavior checks, and rate limits",
  "Delete, export, and disconnect controls designed into the core product",
];

export function getNodeById(id: string) {
  return meshNodes.find((node) => node.id === id);
}

export function getConnectedNodes(id: string) {
  const connectedIds = new Set<string>();
  for (const edge of meshEdges) {
    if (edge.from === id) connectedIds.add(edge.to);
    if (edge.to === id) connectedIds.add(edge.from);
  }
  return meshNodes.filter((node) => connectedIds.has(node.id));
}

export function summarizeMesh() {
  const privateNodes = meshNodes.filter((node) => node.visibility === "private").length;
  const publicNodes = meshNodes.filter((node) => node.visibility === "public").length;
  const trustedNodes = meshNodes.filter((node) => node.visibility === "trusted" || node.visibility === "friends").length;
  const platforms = new Set(meshNodes.map((node) => node.platform).filter((platform) => platform !== "mesh"));

  return {
    nodes: meshNodes.length,
    edges: meshEdges.length,
    platforms: platforms.size,
    privateNodes,
    publicNodes,
    trustedNodes,
  };
}

const normalizedIncludes = (input: string, terms: string[]) => {
  const normalized = input.toLowerCase();
  return terms.some((term) => normalized.includes(term));
};

export function answerMeshiQuestion(question: string): MeshQuestionResult {
  const q = question.trim();
  const fallbackPrivacy = "Meshi only uses content the user can access and always labels whether an answer came from public, trusted, friends-only, or private branches.";

  if (!q) {
    return {
      answer: "Ask me anything about this mesh. Try: Who is John Manning and do we have posts together? Has Jacob ever been to France? How many times have I been seen in a post?",
      sources: ["Demo mesh index"],
      confidence: "demo",
      privacyNote: fallbackPrivacy,
      actions: ["Open privacy vault", "Inspect connected accounts"],
    };
  }

  if (normalizedIncludes(q, ["who is john", "john manning", "who is john manning"])) {
    return {
      answer:
        "John is the private owner node at the center of this mesh. His public internet persona is MediaMan. Based on the demo mesh, you share 14 posts or projects with Stephen, 2 with Jacob, and John appears in 37 imported posts or media items. Private identity details stay behind John's permissions unless he chooses to share them.",
      sources: ["John owner node", "MediaMan persona node", "Stephen relationship edge", "Seen in Posts private index"],
      confidence: "demo",
      privacyNote: "I separated John's private identity from MediaMan's public creator identity because Mesh.me treats personas as permissioned branches, not one forced public profile.",
      actions: ["Show John to MediaMan relationship", "Open Seen in Posts", "Ask Stephen's Meshi"],
    };
  }

  if (normalizedIncludes(q, ["how many times", "seen in", "social media post", "appeared", "tagged"])) {
    return {
      answer:
        "John appears in 37 imported media items in this demo. 19 are public sightings, 18 are private or trusted-only sightings, and the private ones do not appear in public search or other users' meshes unless John changes the branch permission.",
      sources: ["Seen in Posts node", "Instagram Personal tagged-media edge", "Facebook Personal albums edge"],
      confidence: "demo",
      privacyNote: "Face or appearance indexing should be opt-in, revocable, and local/private by default. Mesh.me should never turn recognition into an ad targeting system.",
      actions: ["Review sightings", "Change recognition settings", "Hide private tags"],
    };
  }

  if (normalizedIncludes(q, ["jacob", "france", "paris", "nice"])) {
    return {
      answer:
        "Yes. In the demo mesh, Jacob has a public France Trip cluster connected to posts tagged in Paris and Nice in 2024. Because this answer uses public travel posts, Meshi can answer without exposing private messages or private location data.",
      sources: ["Jacob person node", "France Trip public place node", "Jacob to France Trip edge"],
      confidence: "demo",
      privacyNote: "If Jacob's trip evidence were private or friends-only, Meshi would either ask for permission or answer that it cannot verify from accessible context.",
      actions: ["Open France Trip cluster", "Show public evidence", "Message Jacob"],
    };
  }

  if (normalizedIncludes(q, ["stephen", "there soon", "message", "deliver", "tell stephen"])) {
    return {
      answer:
        "I can prepare an encrypted MeChat delivery to Stephen's Meshi: 'I'll be there soon.' In a production build, this would route through Stephen's Mesh.me inbox or an allowed connected messaging platform, then show delivery status without exposing message contents to Mesh.me.",
      sources: ["Stephen trusted person node", "Message to Stephen route", "MeChat delivery branch"],
      confidence: "demo",
      privacyNote: "The message body should be end-to-end encrypted. Mesh.me should only retain delivery metadata that the user can audit and delete.",
      actions: ["Send encrypted message", "Change delivery platform", "Show audit log"],
    };
  }

  if (normalizedIncludes(q, ["privacy", "secure", "encrypted", "sell", "data", "permissions"])) {
    return {
      answer:
        "Mesh.me's product promise should be: no selling data, no surveillance ads, encrypted credentials, private-by-default imports, transparent permission logs, and per-branch visibility controls. Meshi should answer from a local or permissioned index and cite the exact branches it used.",
      sources: ["Privacy Vault node", "Platform permission scope edges", "Trust stack"],
      confidence: "demo",
      privacyNote: "Security copy in the UI must match the actual implementation. The app should say what is end-to-end encrypted only where that path is truly E2EE.",
      actions: ["Open permission audit", "Export my data", "Disconnect a platform"],
    };
  }

  if (normalizedIncludes(q, ["mediaman", "persona", "public account", "creator"])) {
    return {
      answer:
        "MediaMan is John's public creator persona. It has its own connected YouTube, Instagram Creator, TikTok, Launch Post, and Creator Group branches. Mesh.me lets John keep MediaMan's public audience separate from personal Facebook, private Instagram, family, and trusted-friend branches.",
      sources: ["MediaMan persona node", "YouTube Channel", "Instagram Creator", "TikTok", "Creator Group"],
      confidence: "demo",
      privacyNote: "Persona separation is important because one human can have multiple public/private selves without merging everything into a single exposed profile.",
      actions: ["Open MediaMan branch", "View creator analytics", "Edit persona visibility"],
    };
  }

  const summary = summarizeMesh();
  return {
    answer: `I found ${summary.nodes} nodes, ${summary.edges} relationships, and ${summary.platforms} connected outside platforms in this demo mesh. I can answer best when you ask about a person, post, account, permission, persona, or branch.`,
    sources: ["Demo mesh index", "Mesh summary"],
    confidence: "demo",
    privacyNote: fallbackPrivacy,
    actions: ["Open Mesh map", "Ask about John", "Ask about privacy"],
  };
}
