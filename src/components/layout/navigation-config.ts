import { Bell, Compass, LayoutDashboard, Link2, MessageCircle, Rss, Settings, Shield, Sparkles, User, Users, Waypoints, type LucideIcon } from "lucide-react";

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

export const desktopNavGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { href: "/mesh", icon: Waypoints, label: "Mesh" },
      { href: "/feed", icon: Rss, label: "Feed" },
      { href: "/explore", icon: Compass, label: "Explore" },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/messages", icon: MessageCircle, label: "Messages", badgeKey: "messages" },
      { href: "/notifications", icon: Bell, label: "Notifications", badgeKey: "notifications" },
      { href: "/communities", icon: Users, label: "Communities" },
    ],
  },
  {
    label: "Manage",
    collapsible: true,
    items: [
      { href: "/content-hub", icon: LayoutDashboard, label: "Content Hub" },
      { href: "/connected-accounts", icon: Link2, label: "Connected Accounts" },
      { href: "/trust", icon: Shield, label: "Trust" },
    ],
  },
];

export const desktopBottomItems: NavItem[] = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export const mobileNavItems: NavItem[] = [
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/feed", icon: Rss, label: "Feed" },
  { href: "/innovation", icon: Sparkles, label: "Create" },
  { href: "/messages", icon: MessageCircle, label: "Messages", badgeKey: "messages" },
  { href: "/notifications", icon: Bell, label: "Alerts", badgeKey: "notifications" },
  { href: "/profile", icon: User, label: "You" },
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

  return pathname.startsWith(href);
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
