import { ExploreIcon, FlowIcon, MeChatIcon, MeshIcon, ProfileIcon, type BrandIcon } from "@/components/brand/nav-icons";

export type BadgeKey = "messages" | "notifications";

export interface NavItem {
  href: string;
  icon: BrandIcon;
  label: string;
  badgeKey?: BadgeKey;
}


export const sidebarNavItems: NavItem[] = [
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
  { href: "/profile", icon: ProfileIcon, label: "Profile" },
  { href: "/explore", icon: ExploreIcon, label: "Explore" },
];



export const mobileNavItems: NavItem[] = [
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
  { href: "/profile", icon: ProfileIcon, label: "Profile" },
  { href: "/explore", icon: ExploreIcon, label: "Explore" },
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
