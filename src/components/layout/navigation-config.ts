import { FlowIcon, MeChatIcon, MeshIcon, NotificationsIcon, ProfileIcon, type BrandIcon } from "@/components/brand/nav-icons";

export type BadgeKey = "messages" | "notifications";

export interface NavItem {
  href: string;
  icon: BrandIcon;
  label: string;
  badgeKey?: BadgeKey;
}


// The five persistent rail/tab surfaces — all within the nine core surfaces.
// Notifications replaces Explore here so the Notification Center has a home on
// mobile (not just the top-bar bell); /explore stays reachable via Flow + search.
export const sidebarNavItems: NavItem[] = [
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
  { href: "/notifications", icon: NotificationsIcon, label: "Notifications", badgeKey: "notifications" },
  { href: "/profile", icon: ProfileIcon, label: "Profile" },
];



export const mobileNavItems: NavItem[] = [
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
  { href: "/notifications", icon: NotificationsIcon, label: "Notifications", badgeKey: "notifications" },
  { href: "/profile", icon: ProfileIcon, label: "Profile" },
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
