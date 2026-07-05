import {
  Compass,
  MessageCircle,
  Sparkles,
  User,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export type BadgeKey = "messages" | "notifications";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  badgeKey?: BadgeKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

export const sidebarNavItems: NavItem[] = [
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/feed", icon: Compass, label: "Flow" },
  { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/explore", icon: Sparkles, label: "Explore" },
];

export const desktopNavGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { href: "/mesh", icon: Waypoints, label: "Mesh" },
      { href: "/feed", icon: Compass, label: "Flow" },
      { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
      { href: "/explore", icon: Sparkles, label: "Explore" },
    ],
  },
];

export const desktopBottomItems: NavItem[] = [
  { href: "/profile", icon: User, label: "Profile" },
];

export const mobileNavItems: NavItem[] = [
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/feed", icon: Compass, label: "Flow" },
  { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/explore", icon: Sparkles, label: "Explore" },
];

export function resolveNavHref(href: string, username?: string): string {
  if (href === "/profile") {
    return username ? `/profile/${username}` : "/profile";
  }

  return href;
}

export function isNavItemActive(pathname: string, href: string, username?: string): boolean {
  if (href === "/profile") {
    return Boolean(username && pathname.includes(`/profile/${username}`));
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getBadgeCount(
  badgeKey: BadgeKey | undefined,
  unreadNotifications: number,
  unreadMessages: number,
): number {
  if (badgeKey === "messages") return unreadMessages;
  if (badgeKey === "notifications") return unreadNotifications;
  return 0;
}
