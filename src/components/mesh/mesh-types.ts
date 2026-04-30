// Shared types for Mesh page components

export interface MeshNode {
  id: string;
  type: "self" | "user" | "community" | "tag" | "post" | "platform" | "alter-ego" | "activity";
  label: string;
  sublabel?: string;
  avatarUrl?: string | null;
  href?: string;
  x: number;
  y: number;
  anchorX?: number;
  anchorY?: number;
  orbitRadius?: number;
  orbitAngle?: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
  pulsePhase: number;
  connections: string[];
  isMutual?: boolean;
  isFollowing?: boolean;
  followerCount?: number;
  postCount?: number;
  memberCount?: number;
  likeCount?: number;
  commentCount?: number;
  repostCount?: number;
  content?: string;
  sharedInterests?: string[];
  sharedCommunities?: string[];
  category?: string;
  platform?: string;
  sourceType?: "mesh" | "platform" | "external";
  sourceId?: string;
  connectedAccountId?: string;
  platformPostId?: string;
  platformUserId?: string;
  syncStatus?: string;
  visibility?: string;
  isPinned?: boolean;
  imageUrl?: string | null;
  mediaType?: "text" | "image" | "video" | "audio" | "link" | "unknown";
  mediaAspectRatio?: number;
  interactionCount?: number;
  status?: "online" | "dnd" | "busy" | "offline";
  lastActiveAt?: string | null;
  platformCount?: number;
  engagementScore?: number;
  description?: string;
  branchLabel?: string;
  importance?: number;
  activityType?: string;
  isUnread?: boolean;
}

export interface MeshEdge {
  source: string;
  target: string;
  strength: number;
  type: "follow" | "mutual" | "community" | "interest" | "post" | "platform" | "alter-ego" | "activity" | "shared-community" | "cross-follow" | "platform-content" | "platform-follower";
  interactionCount?: number;
  status?: "online" | "dnd" | "busy" | "offline";
}

export type FilterType = "all" | "user" | "community" | "tag" | "post" | "platform" | "alter-ego" | "activity";

export interface MeshVisualSettings {
  connectionColor?: string;
  nodeStyle?: string;
  motionStyle?: string;
}

// Premium node palette
export const NODE_COLORS: Record<string, string> = {
  self: "#6366f1",
  user: "#818cf8",
  mutual: "#a78bfa",
  community: "#ec4899",
  tag: "#06b6d4",
  post: "#10b981",
  platform: "#f59e0b",
  "alter-ego": "#c084fc",
  activity: "#38bdf8",
};

export const NODE_GLOW: Record<string, string> = {
  self: "rgba(99, 102, 241, 0.3)",
  user: "rgba(129, 140, 248, 0.18)",
  mutual: "rgba(167, 139, 250, 0.22)",
  community: "rgba(236, 72, 153, 0.18)",
  tag: "rgba(6, 182, 212, 0.18)",
  post: "rgba(16, 185, 129, 0.15)",
  platform: "rgba(245, 158, 11, 0.18)",
  "alter-ego": "rgba(192, 132, 252, 0.22)",
  activity: "rgba(56, 189, 248, 0.2)",
};

export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#69C9D0",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  soundcloud: "#FF5500",
  linkedin: "#0A66C2",
  github: "#8B5CF6",
  discord: "#5865F2",
  snapchat: "#FFFC00",
  pinterest: "#E60023",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#ffffff",
  bluesky: "#0085FF",
};

export const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  dnd: "#ef4444",
  busy: "#f59e0b",
  offline: "#6b7280",
};

export function hexAlpha(opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  return Math.round(clamped * 255).toString(16).padStart(2, "0");
}

export function normalizeMediaAspectRatio(value: number | null | undefined): number {
  if (!value || !Number.isFinite(value)) return 1;
  return Math.max(0.48, Math.min(2.15, value));
}

export function getPostNodeSize(node: MeshNode, radius = node.radius): { width: number; height: number } {
  const aspectRatio = normalizeMediaAspectRatio(node.mediaAspectRatio);
  const baseWidth = Math.max(44, Math.min(104, radius * (node.imageUrl ? 4.2 : 4.8)));
  const width = node.mediaType === "text" ? Math.max(baseWidth, 78) : baseWidth;
  const height = node.mediaType === "text"
    ? Math.max(42, Math.min(78, radius * 2.9))
    : Math.max(38, Math.min(118, width / aspectRatio));

  return { width, height };
}
