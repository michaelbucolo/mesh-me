import type { getPrivacyTransparencyData } from "@/lib/queries";

export interface SettingsData {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  isPublic: boolean;
  interests: { id: string; tag: string }[];
  links: { id: string; label: string; url: string }[];
  isMeshPro?: boolean;
}

export interface BlockedUser {
  id: string;
  blocked: { id: string; username: string; displayName: string; avatarUrl: string | null };
}

export type TransparencyData = Awaited<ReturnType<typeof getPrivacyTransparencyData>>;

export interface AlterEgo {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

export const ACCENT_COLORS = [
  "#3b82f6", "#2563eb", "#1d4ed8", "#06b6d4", "#0891b2",
  "#8b5cf6", "#7c3aed", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#6d28d9",
];

export const FEED_LAYOUTS = [
  { id: "card", label: "Card", desc: "Twitter/X style" },
  { id: "grid", label: "Grid", desc: "Instagram style" },
  { id: "vertical", label: "Vertical", desc: "TikTok/Reels style" },
  { id: "compact", label: "Compact", desc: "Reddit style" },
];

export const THEME_OPTIONS = [
  { id: "default", label: "Midnight", bg: "#09090b", accent: "#00d2ff" },
  { id: "instagram", label: "Instagram Glow", bg: "#0f0814", accent: "#ff2d55" },
  { id: "ocean", label: "Deep Ocean", bg: "#061724", accent: "#22d3ee" },
  { id: "sunset", label: "Sunset Pop", bg: "#1b0b12", accent: "#f97316" },
  { id: "forest", label: "Forest Mint", bg: "#091611", accent: "#22c55e" },
  { id: "mono", label: "Mono Pro", bg: "#09090b", accent: "#a1a1aa" },
];
