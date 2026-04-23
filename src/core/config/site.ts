export const SITE_CONFIG = {
  name: "mesh.me",
  defaultUrl: "https://mesh.me",
  title: "mesh.me — Your digital universe, remixed",
  description:
    "A creator-first social operating system that unifies identity, communities, and conversations in one private graph.",
  keywords: [
    "mesh.me",
    "digital identity",
    "unified social platform",
    "privacy-first",
    "social network",
    "universal social",
  ],
} as const;

export function resolveSiteUrl(rawUrl: string | undefined): string {
  if (!rawUrl?.trim()) return SITE_CONFIG.defaultUrl;

  try {
    return new URL(rawUrl).toString().replace(/\/$/, "");
  } catch {
    return SITE_CONFIG.defaultUrl;
  }
}
