import { ExploreIcon, FlowIcon, HomeIcon, MeChatIcon, MeshIcon, ProfileIcon, type BrandIcon } from "@/components/brand/nav-icons";

export type BadgeKey = "messages" | "notifications";

export interface NavItem {
  href: string;
  icon: BrandIcon;
  label: string;
  badgeKey?: BadgeKey;
}


// The persistent surfaces. /feed — the timeline, the one place the "all your
// platforms in one account" promise is readable as a list — used to appear in
// NO navigation at all: reachable only through the command palette, a keyboard
// shortcut, and back-links, while its own topbar called it "Home". A hidden
// home. It leads both navs now. Notifications stays in the top-bar bell,
// Analytics inside Profile, Settings / One Account / MeshPro in the account
// menu. On mobile, Profile is identity chrome and lives where identity already
// lives — the topbar avatar menu — so content keeps the five tab slots.
export const sidebarNavItems: NavItem[] = [
  { href: "/feed", icon: HomeIcon, label: "Home" },
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
  { href: "/explore", icon: ExploreIcon, label: "Explore" },
  { href: "/profile", icon: ProfileIcon, label: "Profile" },
];



export const mobileNavItems: NavItem[] = [
  { href: "/feed", icon: HomeIcon, label: "Home" },
  { href: "/mesh", icon: MeshIcon, label: "Mesh" },
  { href: "/flow", icon: FlowIcon, label: "Flow" },
  { href: "/messages", icon: MeChatIcon, label: "MeChat", badgeKey: "messages" },
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
