import { AnalyticsIcon, ExploreIcon, FlowIcon, MeChatIcon, MeshIcon, type BrandIcon } from "@/components/brand/nav-icons";

export type BadgeKey = "messages" | "notifications";

export interface NavItem {
  href: string;
  icon: BrandIcon;
  label: string;
  badgeKey?: BadgeKey;
}


// THE FIVE TABS: Mesh · MeChat · Flow · Explore · Analytics — the same set in
// the same order on the desktop rail and the mobile bar, so the product has
// one navigation, not two. Mesh is home (the proxy already lands "/" there).
// Everything displaced still has a visible door: /feed sits behind the
// command palette, its keyboard shortcut, and back-links; Profile is identity
// chrome (the sidebar user dock on desktop, the topbar avatar menu on
// mobile); Notifications stays in the top-bar bell; Settings / One Account /
// MeshPro live in the account menu. Analytics is promoted from a profile tab
// to a first-class destination at /analytics.
export const primaryNavItems: NavItem[] = [
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/explore", icon: ExploreIcon, label: "Explore" },
  { href: "/analytics", icon: AnalyticsIcon, label: "Analytics" },
];

export function resolveNavHref(href: string, username?: string): string {
  if (href === "/profile") {
    return username ? `/profile/${username}` : "/profile";
  }

  return href;
}

export function isNavItemActive(pathname: string, href: string, username?: string): boolean {
  if (href === "/profile") {
    // Exact/segment match — `includes` lit up @sam's tab on @samantha's profile
    // (wrong active state + a false "current page" for screen readers).
    return Boolean(
      username &&
        (pathname === `/profile/${username}` || pathname.startsWith(`/profile/${username}/`)),
    );
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
