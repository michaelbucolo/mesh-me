"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  BarChart3,
  Bell,
  ChevronDown,
  Command,
  Compass,
  Crown,
  FileText,
  Keyboard,
  Lightbulb,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Network,
  PlusCircle,
  Rss,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/actions";
import { getRouteLoadingPersonality } from "@/lib/loading-personality";
import { openMeshi } from "@/lib/meshi-events";
import { MeshiBrandLockup, UserMeshiBadge } from "@/components/meshi/meshi-identity";
import { CommandPalette, openCommandPalette } from "@/components/layout/command-palette";
import { KeyboardShortcutsOverlay, openKeyboardShortcutsOverlay } from "@/components/layout/keyboard-shortcuts-overlay";
import { MobileNav } from "@/components/layout/mobile-nav";
import { WhatsNewDrawer } from "@/components/layout/whats-new-drawer";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    onboarded: boolean;
  };
}

type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type FlowAction = ShellNavItem & {
  kind?: "link" | "meshi";
  helper?: string;
};

type RouteGuide = {
  label: string;
  kicker: string;
  description: string;
  icon: LucideIcon;
  primary: ShellNavItem;
  secondary?: ShellNavItem;
};

type QuickCommandAction = FlowAction & {
  tone?: "primary" | "secondary";
};

type UnreadCounts = {
  unreadNotifications: number;
  unreadMessages: number;
};

const primaryNavItems = [
  { href: "/feed", label: "Home", icon: Rss },
  { href: "/mesh", label: "Mesh", icon: Waypoints },
  { href: "/search", label: "Search", icon: Search },
  { href: "/messages", label: "MeChat", icon: MessageCircle },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
] satisfies ShellNavItem[];

const moreNavItems = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/connected-accounts", label: "Connections", icon: ShieldCheck },
  { href: "/privacy-controls", label: "Privacy", icon: ShieldCheck },
  { href: "/feature-requests", label: "Ideas", icon: Lightbulb },
  { href: "/communities", label: "Communities", icon: UsersRound },
  { href: "/vault", label: "Vault", icon: FileText },
  { href: "/meshpro", label: "Mesh Pro", icon: Crown },
] satisfies ShellNavItem[];

const dashboardQuickLinks = [
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/mesh", label: "Mesh", icon: Waypoints },
  { href: "/messages", label: "MeChat", icon: MessageCircle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] satisfies ShellNavItem[];

const routeGuides: Record<string, RouteGuide> = {
  "/analytics": {
    label: "Analytics",
    kicker: "Understand",
    description: "See performance, privacy health, and where your digital world is growing.",
    icon: BarChart3,
    primary: { href: "/connected-accounts", label: "Connect", icon: ShieldCheck },
    secondary: { href: "/settings", label: "Controls", icon: Settings },
  },
  "/communities": {
    label: "Communities",
    kicker: "Belong",
    description: "Find groups, shared spaces, and people who belong in your Mesh.",
    icon: UsersRound,
    primary: { href: "/communities/create", label: "Create", icon: PlusCircle },
    secondary: { href: "/explore", label: "Explore", icon: Compass },
  },
  "/connected-accounts": {
    label: "Connections",
    kicker: "Sync",
    description: "Choose exactly which platforms feed your private Mesh.me experience.",
    icon: ShieldCheck,
    primary: { href: "/mesh", label: "Dashboard", icon: Waypoints },
    secondary: { href: "/trust", label: "Trust", icon: ShieldCheck },
  },
  "/content-hub": {
    label: "Content Hub",
    kicker: "Manage",
    description: "Organize posts, sources, and cross-platform publishing from one place.",
    icon: FileText,
    primary: { href: "/feed?compose=true", label: "Create", icon: WandSparkles },
    secondary: { href: "/mesh", label: "Map it", icon: Waypoints },
  },
  "/explore": {
    label: "Explore",
    kicker: "Discover",
    description: "Find people, posts, communities, and new branches for your world.",
    icon: Compass,
    primary: { href: "/feed", label: "Feed", icon: Sparkles },
    secondary: { href: "/communities", label: "Groups", icon: UsersRound },
  },
  "/feed": {
    label: "Feed",
    kicker: "Scroll",
    description: "Read, post, react, and share without leaving your unified world.",
    icon: Rss,
    primary: { href: "/mesh", label: "Dashboard", icon: Waypoints },
    secondary: { href: "/messages", label: "Share", icon: MessageCircle },
  },
  "/feature-requests": {
    label: "Ideas",
    kicker: "Request",
    description: "Submit product ideas, upvote what matters, and track what is planned, building, or released.",
    icon: Lightbulb,
    primary: { href: "/feature-requests", label: "Board", icon: Lightbulb },
    secondary: { href: "/roadmap", label: "Roadmap", icon: Sparkles },
  },
  "/innovation": {
    label: "Create",
    kicker: "Publish",
    description: "Turn one idea into Mesh.me content and cross-platform updates.",
    icon: WandSparkles,
    primary: { href: "/feed?compose=true", label: "Post", icon: WandSparkles },
    secondary: { href: "/content-hub", label: "Content", icon: FileText },
  },
  "/marketplace": {
    label: "Marketplace",
    kicker: "Customize",
    description: "Find creator tools, Meshi items, and privacy-first upgrades.",
    icon: Sparkles,
    primary: { href: "/meshpro", label: "Mesh Pro", icon: Crown },
    secondary: { href: "/vault", label: "Vault", icon: FileText },
  },
  "/messages": {
    label: "MeChat",
    kicker: "Talk",
    description: "Messages, shared posts, and group browsing stay together here.",
    icon: MessageCircle,
    primary: { href: "/mesh", label: "Dashboard", icon: Waypoints },
    secondary: { href: "/notifications", label: "Alerts", icon: Bell },
  },
  "/meshi-voice": {
    label: "Meshi Voice",
    kicker: "Ask",
    description: "Talk to Meshi as your private companion for search, help, and control.",
    icon: WandSparkles,
    primary: { href: "/mesh", label: "Open Mesh", icon: Network },
    secondary: { href: "/settings", label: "Customize", icon: Settings },
  },
  "/meshpro": {
    label: "Mesh Pro",
    kicker: "Upgrade",
    description: "Unlock deeper analytics, more Meshi identity, and richer personalization.",
    icon: Crown,
    primary: { href: "/settings", label: "Manage", icon: Settings },
    secondary: { href: "/marketplace", label: "Items", icon: Sparkles },
  },
  "/notifications": {
    label: "Alerts",
    kicker: "Notice",
    description: "One calm place for messages, follows, comments, privacy, and security updates.",
    icon: Bell,
    primary: { href: "/messages", label: "MeChat", icon: MessageCircle },
    secondary: { href: "/settings", label: "Tune", icon: Settings },
  },
  "/privacy-controls": {
    label: "Privacy",
    kicker: "Control",
    description: "Review connected data, permissions, visibility, exports, and deletion.",
    icon: ShieldCheck,
    primary: { href: "/connected-accounts", label: "Connections", icon: ShieldCheck },
    secondary: { href: "/account/delete", label: "Delete", icon: LogOut },
  },
  "/search": {
    label: "Search",
    kicker: "Find",
    description: "Search your people, posts, communities, and connected content.",
    icon: Search,
    primary: { href: "/explore", label: "Explore", icon: Compass },
    secondary: { href: "/mesh", label: "Map", icon: Network },
  },
  "/settings": {
    label: "Settings",
    kicker: "Control",
    description: "Privacy, security, Meshi, notifications, and account controls live here.",
    icon: Settings,
    primary: { href: "/connected-accounts", label: "Connections", icon: ShieldCheck },
    secondary: { href: "/analytics", label: "Privacy score", icon: BarChart3 },
  },
  "/spaces": {
    label: "Spaces",
    kicker: "Collaborate",
    description: "Shared Mesh areas for friends, families, teams, and communities.",
    icon: UsersRound,
    primary: { href: "/communities", label: "Groups", icon: UsersRound },
    secondary: { href: "/messages", label: "MeChat", icon: MessageCircle },
  },
  "/super-app": {
    label: "Super App",
    kicker: "Replace",
    description: "Track which daily social workflows Mesh.me can already absorb.",
    icon: Sparkles,
    primary: { href: "/connected-accounts", label: "Connect", icon: ShieldCheck },
    secondary: { href: "/content-hub", label: "Content", icon: FileText },
  },
  "/vault": {
    label: "Vault",
    kicker: "Save",
    description: "Keep memories, posts, conversations, and references in one private archive.",
    icon: FileText,
    primary: { href: "/content-hub", label: "Organize", icon: FileText },
    secondary: { href: "/mesh", label: "Map", icon: Network },
  },
};

const fullSurfaceSegments = new Set([
  "account",
  "analytics",
  "billing",
  "communities",
  "connected-accounts",
  "content-hub",
  "explore",
  "feature-requests",
  "feed",
  "feedback",
  "innovation",
  "marketplace",
  "mesh",
  "meshi-voice",
  "meshpro",
  "messages",
  "notifications",
  "privacy-controls",
  "profile",
  "search",
  "settings",
  "spaces",
  "super-app",
  "vault",
]);

function isActivePath(pathname: string, href: string) {
  if (href.includes("?")) return false;
  const baseHref = href.split("?")[0];
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function isFullSurfacePath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  return fullSurfaceSegments.has(firstSegment);
}

function getRouteGuide(pathname: string, username: string): RouteGuide | null {
  if (pathname === "/mesh") return null;
  if (pathname.startsWith(`/profile/${username}`) || pathname === "/profile") {
    return {
      label: "Profile",
      kicker: "Identity",
      description: "Your Meshi, posts, links, and public presence are centered here.",
      icon: Network,
      primary: { href: "/settings", label: "Edit", icon: Settings },
      secondary: { href: "/feed", label: "Post", icon: WandSparkles },
    };
  }

  const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  return routeGuides[pathname] ?? routeGuides[firstSegment] ?? null;
}

function dedupeActions<T extends FlowAction>(actions: T[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.kind === "meshi" ? "meshi" : action.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getQuickCommandActions(pathname: string, username: string, routeGuide: RouteGuide | null): QuickCommandAction[] {
  if (pathname === "/mesh") {
    return [
      { href: "/feed?compose=true", label: "Create", icon: WandSparkles, helper: "Post", tone: "primary" },
      { href: "/feed", label: "Feed", icon: Sparkles, helper: "Scroll" },
      { href: "#meshi", label: "Meshi", icon: Bot, kind: "meshi", helper: "Ask" },
    ];
  }

  const routeActions = routeGuide
    ? [routeGuide.primary, routeGuide.secondary].filter(Boolean) as ShellNavItem[]
    : [];

  const actions: QuickCommandAction[] = [
    {
      href: routeActions[0]?.href ?? "/mesh",
      label: routeActions[0]?.href === "/mesh" ? "Mesh" : routeActions[0]?.label ?? "Mesh",
      icon: routeActions[0]?.icon ?? Waypoints,
      helper: "Next",
      tone: "primary",
    },
    { href: "/feed?compose=true", label: "Create", icon: WandSparkles, helper: "Post" },
    { href: "#meshi", label: "Meshi", icon: Bot, kind: "meshi", helper: "Ask" },
    { href: `/profile/${username}`, label: "You", icon: Network, helper: "Profile" },
  ];

  return dedupeActions(actions).slice(0, 4);
}

function AppRouteProgress({ pathname }: { pathname: string }) {
  return (
    <div
      key={pathname}
      className="app-route-progress"
      data-loading-personality={getRouteLoadingPersonality(pathname)}
      aria-hidden="true"
    />
  );
}

function QuickCommandBar({
  pathname,
  username,
  routeGuide,
}: {
  pathname: string;
  username: string;
  routeGuide: RouteGuide | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const actions = useMemo(() => getQuickCommandActions(pathname, username, routeGuide), [pathname, routeGuide, username]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.closest("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <section className="app-command-bar mb-3 grid gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/68 p-2 shadow-[var(--shadow-sm)] backdrop-blur md:mb-4 lg:grid-cols-[minmax(16rem,1fr)_auto]" aria-label="Quick command bar">
      <form onSubmit={submitSearch} className="app-command-search flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-input)]/72 px-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <label htmlFor="app-command-search" className="sr-only">Search Mesh.me</label>
        <input
          id="app-command-search"
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Search Mesh.me..."
          type="search"
        />
        <kbd className="hidden rounded-md border border-[var(--border-primary)] px-1.5 py-1 text-[10px] font-black text-[var(--text-muted)] sm:inline-flex">/</kbd>
      </form>

      <div className="grid grid-cols-4 gap-2 sm:flex sm:overflow-x-auto">
        {actions.map((action) => {
          const Icon = action.icon;
          const className = action.tone === "primary"
            ? "mesh-action mesh-action-primary app-command-action"
            : "mesh-choice app-command-action text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

          if (action.kind === "meshi") {
            return (
              <button key="meshi-command" type="button" onClick={() => openMeshi("actions")} className={className} aria-label="Ask Meshi">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{action.label}</span>
                {action.helper && <span className="app-command-helper">{action.helper}</span>}
              </button>
            );
          }

          return (
            <Link key={action.href} href={action.href} className={className}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{action.label}</span>
              {action.helper && <span className="app-command-helper">{action.helper}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ShellTopBar({
  pathname,
  user,
  routeGuide,
  unreadCounts,
}: {
  pathname: string;
  user: AppShellProps["user"];
  routeGuide: RouteGuide | null;
  unreadCounts: UnreadCounts;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const currentLabel = pathname === "/mesh" ? "The Mesh" : routeGuide?.label ?? "Mesh.me";
  const currentKicker = pathname === "/mesh" ? "Dashboard" : routeGuide?.kicker ?? "Home";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <header className="app-topbar sticky top-0 z-30 mb-3 hidden min-w-0 items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/94 px-3 py-2 shadow-[var(--shadow-sm)] backdrop-blur-xl md:flex lg:mb-4" data-app-topbar>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{currentKicker}</p>
        <h1 className="truncate text-base font-black text-[var(--text-primary)] lg:text-lg">{currentLabel}</h1>
      </div>

      <form onSubmit={submitSearch} className="app-topbar-search ml-auto hidden min-w-[13rem] max-w-[30rem] flex-1 items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-input)] px-3 py-2 lg:flex">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <label htmlFor="app-topbar-search" className="sr-only">Search Mesh.me</label>
        <input
          id="app-topbar-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Search people, posts, chats..."
          type="search"
        />
      </form>

      <nav className="app-topbar-quick hidden items-center gap-1 xl:flex" aria-label="Quick access">
        {dashboardQuickLinks.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-topbar-link ${active ? "app-topbar-link-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <Link href="/search" className="app-topbar-icon lg:hidden" aria-label="Search" title="Search">
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          className="app-topbar-icon"
          aria-label="Command palette"
          aria-keyshortcuts="Control+K Meta+K"
          title="Command palette"
        >
          <Command className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openKeyboardShortcutsOverlay}
          className="app-topbar-icon"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="?"
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => openMeshi("actions")} className="app-topbar-icon" aria-label="Ask Meshi" title="Ask Meshi">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link href="/messages" className="app-topbar-icon relative" aria-label="MeChat" title="MeChat">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {unreadCounts.unreadMessages > 0 && (
            <span className="app-topbar-badge">{unreadCounts.unreadMessages > 99 ? "99+" : unreadCounts.unreadMessages}</span>
          )}
        </Link>
        <Link href="/notifications" className="app-topbar-icon relative" aria-label="Notifications" title="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCounts.unreadNotifications > 0 && (
            <span className="app-topbar-badge">{unreadCounts.unreadNotifications > 99 ? "99+" : unreadCounts.unreadNotifications}</span>
          )}
        </Link>

        <details className="app-profile-menu relative">
          <summary className="app-profile-summary flex cursor-pointer list-none items-center gap-2 rounded-full px-2 py-1.5 [&::-webkit-details-marker]:hidden" aria-label="Profile menu">
            <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={28} />
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-[9rem] truncate text-sm font-black text-[var(--text-primary)]">{user.displayName}</span>
              <span className="block max-w-[9rem] truncate text-[10px] font-bold text-[var(--text-muted)]">@{user.username}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-[var(--text-muted)] lg:block" aria-hidden="true" />
          </summary>
          <div className="app-profile-popover absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] p-2">
              <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--text-primary)]">{user.displayName}</p>
                <p className="truncate text-xs font-semibold text-[var(--text-muted)]">@{user.username}</p>
              </div>
            </div>
            <div className="mt-2 grid gap-1">
              <Link href={`/profile/${user.username}`} className="app-profile-menu-item">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Profile
              </Link>
              <Link href="/settings" className="app-profile-menu-item">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </Link>
              <Link href="/privacy-controls" className="app-profile-menu-item">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Privacy controls
              </Link>
              <button type="button" onClick={openKeyboardShortcutsOverlay} className="app-profile-menu-item w-full">
                <Keyboard className="h-4 w-4" aria-hidden="true" />
                Keyboard shortcuts
              </button>
              <button type="button" onClick={openCommandPalette} className="app-profile-menu-item w-full">
                <Command className="h-4 w-4" aria-hidden="true" />
                Command palette
              </button>
              <form action={signOut}>
                <button type="submit" className="app-profile-menu-item app-profile-menu-danger w-full">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const routeGuide = useMemo(() => getRouteGuide(pathname, user.username), [pathname, user.username]);
  const isFeedSurface = pathname === "/feed" || pathname.startsWith("/feed/");
  const isSocialSurface = pathname === "/feed" || pathname.startsWith("/feed/") || pathname === "/profile" || pathname.startsWith("/profile/");
  const isMeshSurface = pathname === "/mesh" || pathname.startsWith("/mesh/");
  const isFullSurface = isFullSurfacePath(pathname);
  const showCommandBar = false;
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    unreadNotifications: 0,
    unreadMessages: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCounts() {
      const response = await fetch("/api/layout/unread-counts", {
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => null);

      if (!response?.ok || cancelled) return;

      const payload = await response.json().catch(() => null);
      if (!payload || cancelled) return;

      setUnreadCounts({
        unreadNotifications: Number(payload.unreadNotifications ?? 0),
        unreadMessages: Number(payload.unreadMessages ?? 0),
      });
    }

    void loadUnreadCounts();
    const intervalId = window.setInterval(loadUnreadCounts, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const renderNavLink = (item: ShellNavItem) => {
    const resolvedHref = item.href === "/profile" ? `/profile/${user.username}` : item.href;
    const active = isActivePath(pathname, resolvedHref);
    const Icon = item.icon;
    const isMeshSlot = item.href === "/mesh";

    return (
      <Link
        key={item.href}
        href={resolvedHref}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        title={item.label}
        className={`app-x-nav-link group flex shrink-0 items-center justify-center px-0 py-2.5 text-sm font-bold transition-all lg:justify-start lg:gap-3 lg:px-3 ${
          active
            ? "app-x-nav-link-active"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        } ${isMeshSlot ? "app-x-nav-link-mesh" : ""}`}
      >
        <Icon className="app-x-nav-icon h-[21px] w-[21px] lg:h-[22px] lg:w-[22px]" aria-hidden="true" />
        <span className="hidden text-[1.04rem] lg:inline">{item.label}</span>
      </Link>
    );
  };
  const moreActive = moreNavItems.some((item) => isActivePath(pathname, item.href));

  return (
    <div className={`mesh-aurora app-shell-layout h-dvh max-h-dvh min-h-0 overflow-hidden text-[var(--text-primary)] md:grid md:grid-cols-[4.5rem_1fr] lg:grid-cols-[16rem_1fr] xl:grid-cols-[17rem_1fr] ${isFeedSurface ? "app-shell-layout-feed" : ""} ${isMeshSurface ? "app-shell-layout-mesh" : ""} ${isFullSurface ? "app-shell-layout-surface" : ""}`}>
      <AppRouteProgress pathname={pathname} />
      <aside
        data-sidebar
        className={`app-sidebar app-x-sidebar safe-area-top sticky top-0 z-40 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/94 px-3 py-2.5 backdrop-blur-xl md:flex md:h-dvh md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:py-4 lg:px-3 xl:px-4 ${isFullSurface ? "app-sidebar-surface" : ""}`}
      >
        <div className="flex items-center justify-between gap-2 md:block">
          <MeshiBrandLockup
            href="/mesh"
            size={34}
            label="Mesh.me"
            useUserMeshi
            className="min-w-0 text-base sm:text-lg md:hidden lg:inline-flex"
          />
          <MeshiBrandLockup
            href="/mesh"
            size={36}
            label="Mesh.me"
            useUserMeshi
            showWordmark={false}
            className="mx-auto hidden justify-center md:inline-flex lg:hidden"
          />
          <div className="flex shrink-0 items-center gap-1 md:hidden" aria-label="Account actions">
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Command palette"
              title="Command palette"
              className="mesh-choice flex h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--text-secondary)]"
            >
              <Command size={17} aria-hidden="true" />
            </button>
            <Link
              href="/search"
              aria-label="Search"
              title="Search"
              className="mesh-choice flex h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--text-secondary)]"
            >
              <Search size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="mesh-choice relative flex h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--text-secondary)]"
            >
              <Bell size={17} aria-hidden="true" />
              {unreadCounts.unreadNotifications > 0 && (
                <span className="app-mobile-action-badge">{unreadCounts.unreadNotifications > 99 ? "99+" : unreadCounts.unreadNotifications}</span>
              )}
            </Link>
            <Link
              href={`/profile/${user.username}`}
              aria-label="Open profile"
              title="Profile"
              className="mesh-choice flex h-10 w-10 items-center justify-center rounded-md p-0 text-[var(--text-secondary)]"
            >
              <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={24} />
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="mobile-signout-pill inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-black"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mt-4 hidden flex-1 flex-col gap-1 md:flex lg:mt-5" aria-label="Primary">
          <div className="grid gap-1">{primaryNavItems.map(renderNavLink)}</div>
          <button
            type="button"
            onClick={openCommandPalette}
            className="app-x-nav-link flex shrink-0 items-center justify-center px-0 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)] lg:justify-start lg:gap-3 lg:px-3"
            aria-label="Command palette"
            aria-keyshortcuts="Control+K Meta+K"
            title="Command palette"
          >
            <Command className="app-x-nav-icon h-[21px] w-[21px] lg:h-[22px] lg:w-[22px]" aria-hidden="true" />
            <span className="hidden text-[1.04rem] lg:inline">Commands</span>
          </button>
          <details className="block" open={moreActive}>
            <summary
              className={`app-x-nav-link flex cursor-pointer list-none items-center justify-center px-0 py-2.5 text-sm font-bold lg:justify-start lg:gap-3 lg:px-3 [&::-webkit-details-marker]:hidden ${
                moreActive
                  ? "app-x-nav-link-active"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              aria-label="More pages"
              title="More pages"
            >
              <MoreHorizontal className="app-x-nav-icon h-[22px] w-[22px]" aria-hidden="true" />
              <span className="hidden text-[1.04rem] lg:inline">More</span>
            </summary>
            <div className="app-more-panel mt-1 grid gap-1">{moreNavItems.map(renderNavLink)}</div>
          </details>

          <Link
            href="/feed?compose=true"
            className="app-compose-button mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full px-3 text-sm font-black"
            aria-label="Create post"
            title="Create post"
          >
            <PlusCircle className="h-[21px] w-[21px]" aria-hidden="true" />
            <span className="hidden lg:inline">Post</span>
          </Link>
        </nav>

        <div className="mt-auto hidden pt-3 md:block">
          <div className="app-profile-dock hidden rounded-full p-2 lg:block">
            <Link href={`/profile/${user.username}`} className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-[var(--text-primary)]">
              <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={30} />
              <span className="min-w-0">
                <span className="block truncate">{user.displayName}</span>
                <span className="block truncate text-xs font-semibold text-[var(--text-muted)]">@{user.username}</span>
              </span>
            </Link>
            <div className="app-account-actions mt-3 grid gap-2">
              <Link href="/settings" className="app-account-action" aria-label="Settings" title="Settings">
                <Settings size={16} aria-hidden="true" />
                Settings
              </Link>
              <form action={signOut}>
                <button type="submit" className="app-account-action app-account-action-danger w-full" aria-label="Sign out" title="Sign out">
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </div>

          <div className="grid gap-2 lg:hidden">
            <div className="app-profile-dock flex justify-center rounded-full p-2">
              <UserMeshiBadge displayName={user.displayName} username={user.username} compact />
            </div>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="mesh-choice flex h-11 w-full items-center justify-center rounded-md p-0 text-[var(--text-secondary)]"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </form>
            {!user.onboarded && (
              <Link href="/onboarding" className="mesh-choice flex h-11 items-center justify-center rounded-md p-0 text-[var(--text-secondary)]" aria-label="Finish setup" title="Finish setup">
                <Sparkles size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </aside>

      <main className={`app-main flex min-h-0 min-w-0 flex-col overflow-hidden px-3 py-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:px-4 md:h-dvh md:px-4 md:py-4 md:pb-4 lg:px-6 lg:py-6 lg:pb-6 xl:px-8 xl:py-7 ${isSocialSurface ? "app-main-social" : ""} ${isFeedSurface ? "app-main-feed" : ""} ${isMeshSurface ? "app-main-mesh" : ""} ${isFullSurface ? "app-main-surface" : ""}`}>
        {!isFullSurface && <ShellTopBar pathname={pathname} user={user} routeGuide={routeGuide} unreadCounts={unreadCounts} />}
        {showCommandBar && <QuickCommandBar pathname={pathname} username={user.username} routeGuide={routeGuide} />}

        <div key={pathname} className={`app-route-slot min-h-0 flex-1 animate-page-enter ${isFullSurface ? "app-route-slot-surface" : ""}`}>
          {children}
        </div>
      </main>
      <MobileNav username={user.username} unreadMessages={unreadCounts.unreadMessages} unreadNotifications={unreadCounts.unreadNotifications} />
      <WhatsNewDrawer userId={user.id} />
      <CommandPalette username={user.username} />
      <KeyboardShortcutsOverlay username={user.username} />
    </div>
  );
}
