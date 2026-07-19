import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Guard a URL before placing it in an href/src. React does not sanitize hrefs,
 * so a `javascript:`/`data:`/`vbscript:` URL in user- or platform-supplied
 * content would execute on click. Returns the URL only when it's http(s) (or a
 * site-relative path); otherwise undefined so the link renders inert.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  // Site-relative paths are safe (but not protocol-relative "//host").
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Human "last online" label for an offline user. "Active now" is reserved for
// the live-presence path, so this starts at "Active recently" for the sub-2-min
// gap and never claims someone is online.
export function formatLastActive(date: Date | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (minutes < 2) return "Active recently";
  if (minutes < 60) return `Active ${minutes}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days < 7) return `Active ${days}d ago`;
  if (days < 28) return `Active ${weeks}w ago`;
  return `Active on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}


export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export const INTEREST_TAGS = [
  "Music", "Art", "Photography", "Film", "Gaming", "Technology",
  "Design", "Fashion", "Writing", "Poetry", "Comedy", "Dance",
  "Fitness", "Cooking", "Travel", "Nature", "Science", "Philosophy",
  "Anime", "Sports", "Business", "Education", "Health", "Spirituality",
  "DIY", "Podcasts", "Streaming", "3D Art", "Machine Learning", "Web Development",
];
