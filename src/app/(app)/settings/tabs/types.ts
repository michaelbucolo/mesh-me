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
  { id: "midnight", label: "Midnight", bg: "#09090b", accent: "#3b82f6" },
  { id: "oled", label: "OLED Black", bg: "#000000", accent: "#60a5fa" },
  { id: "deep-ocean", label: "Deep Ocean", bg: "#0c1222", accent: "#06b6d4" },
  { id: "dark-violet", label: "Dark Violet", bg: "#0f0720", accent: "#8b5cf6" },
  { id: "charcoal", label: "Charcoal", bg: "#171717", accent: "#3b82f6" },
];
