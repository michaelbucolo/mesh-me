import {
  Archive,
  Bell,
  Compass,
  Home,
  Link2,
  Layers3,
  MessageCircle,
  Settings,
  ShieldCheck,
  User,
  Users,
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
  { href: "/mesh", icon: Home, label: "The Mesh" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/spaces", icon: Layers3, label: "Spaces" },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/connected-accounts", icon: Link2, label: "Connections" },
  { href: "/vault", icon: Archive, label: "Vault" },
  { href: "/trust", icon: ShieldCheck, label: "Verify" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export const desktopNavGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { href: "/mesh", icon: Waypoints, label: "Mesh" },
      { href: "/feed", icon: Compass, label: "Feed" },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
      { href: "/notifications", icon: Bell, label: "Alerts", badgeKey: "notifications" },
      { href: "/communities", icon: Users, label: "Communities" },
      { href: "/spaces", icon: Layers3, label: "Spaces" },
    ],
  },
  {
    label: "Manage",
    collapsible: true,
    items: [
      { href: "/connected-accounts", icon: Link2, label: "Connections" },
      { href: "/vault", icon: Archive, label: "Vault" },
      { href: "/trust", icon: ShieldCheck, label: "Verify" },
    ],
  },
];

export const desktopBottomItems: NavItem[] = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export const mobileNavItems: NavItem[] = [
  { href: "/mesh", icon: Waypoints, label: "Mesh" },
  { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
  { href: "/feed", icon: Compass, label: "Flow" },
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
