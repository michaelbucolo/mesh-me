import { Archive, BarChart3, Bell, Compass, CreditCard, Layers3, LayoutDashboard, Link2, MessageCircle, Rss, Settings, Shield, Smartphone, Sparkles, User, Users, Waypoints, type LucideIcon } from "lucide-react";

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
      { href: "/analytics", icon: BarChart3, label: "Analytics" },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
      { href: "/notifications", icon: Bell, label: "Alerts", badgeKey: "notifications" },
      { href: "/explore", icon: Compass, label: "Explore" },
      { href: "/communities", icon: Users, label: "Communities" },
      { href: "/spaces", icon: Layers3, label: "Spaces" },
    ],
  },
  {
    label: "Manage",
    collapsible: true,
    items: [
      { href: "/content-hub", icon: LayoutDashboard, label: "Content Hub" },
      { href: "/connected-accounts", icon: Link2, label: "Connections" },
      { href: "/vault", icon: Archive, label: "Vault" },
      { href: "/meshpro", icon: Sparkles, label: "Mesh Pro" },
      { href: "/billing", icon: CreditCard, label: "Billing" },
      { href: "/privacy-controls", icon: Shield, label: "Privacy" },
      { href: "/trust", icon: Shield, label: "Trust" },
      { href: "/super-app", icon: Smartphone, label: "Super App" },
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
  { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
  { href: "/spaces", icon: Layers3, label: "Spaces" },
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
