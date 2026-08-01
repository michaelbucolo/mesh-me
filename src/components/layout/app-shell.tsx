"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useAnimationControls } from "framer-motion";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Moon,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { signOut } from "@/lib/actions";
import { readGhostMode } from "@/lib/ghost-mode";
import { readWhereShare } from "@/lib/where-share";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";
import { shareContent } from "@/lib/native/share";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { Avatar } from "@/components/ui/avatar";
import { GhostModeToggle } from "@/components/layout/ghost-mode-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { primaryNavItems, resolveNavHref, isNavItemActive, type NavItem } from "@/components/layout/navigation-config";

const CommandPalette = dynamic(
  () => import("@/components/layout/command-palette").then((module) => module.CommandPalette),
  { ssr: false },
);
const KeyboardShortcutsOverlay = dynamic(
  () => import("@/components/layout/keyboard-shortcuts-overlay").then((module) => module.KeyboardShortcutsOverlay),
  { ssr: false },
);

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    onboarded: boolean;
    ghostMode: boolean;
  };
}

type UnreadCounts = {
  unreadNotifications: number;
  unreadMessages: number;
};

type RouteInfo = {
  title: string;
  description: string;
};

const routeInfoMap: Record<string, RouteInfo> = {
  "/mesh": { title: "The Mesh", description: "Your accounts and connections in one graph." },
  "/feed": { title: "Feed", description: "Your timeline across all connected platforms." },
  // NOT "your universal messaging hub, all your conversations in one place".
  // Measured from src/lib/platform-capabilities.ts: no listed messenger can
  // sync a message, because none expose an official direct-message API to
  // connected apps. The claim was false for every single one of them, and it
  // was the page description — the first thing said about this surface.
  // scripts/unified-claim-check.ts derives what may be said here from what
  // the capability table actually supports.
  "/messages": { title: "MeChat", description: "Your mesh.me conversations." },
  "/notifications": { title: "Notifications", description: "Stay updated on what matters." },
  "/search": { title: "Search", description: "Find people, posts, and communities." },
  "/communities": { title: "Communities", description: "Discover, join, and build with communities around the world." },
  "/connected-accounts": { title: "One Account", description: "Every platform and account, threading back to one you." },
  "/trust": { title: "Verify", description: "Identity verification and trust management." },
  "/settings": { title: "Settings", description: "Configure your Mesh.me experience." },
  "/analytics": { title: "Analytics", description: "Understand your digital footprint." },
  "/explore": { title: "Explore", description: "Discover new content, people, and communities." },
  "/privacy-controls": { title: "Privacy", description: "Control your data, permissions, and visibility." },
  "/meshpro": { title: "MeshPro", description: "Unlock deeper analytics and richer personalization." },
  "/billing": { title: "Billing", description: "Manage your subscription and payments." },
  "/admin": { title: "Admin", description: "Platform administration." },
};

function getRouteInfo(pathname: string, username: string): RouteInfo {
  if (pathname.startsWith(`/profile/${username}`) || pathname === "/profile") {
    return { title: "Profile", description: "Your identity. Your story. Your Mesh." };
  }

  if (pathname.startsWith("/profile/")) {
    return { title: "Profile", description: "View this person's public Mesh." };
  }

  if (pathname.startsWith("/communities/")) {
    return { title: "Community", description: "Explore this community." };
  }

  const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  return routeInfoMap[pathname] ?? routeInfoMap[firstSegment] ?? { title: "Mesh.me", description: "" };
}

type NavDir = "forward" | "back" | "dive" | "rise" | undefined;
const isOnMesh = (p: string) => p === "/mesh" || p.startsWith("/mesh/");
const isOnFlow = (p: string) => p === "/flow" || p.startsWith("/flow/");

// Shared morphing sidebar indicator + a spring pop when an icon lands active.
const SIDEBAR_INDICATOR_SPRING = { type: "spring" as const, stiffness: 380, damping: 30 };
const SIDEBAR_ICON_POP = { duration: 0.46, ease: [0.34, 1.56, 0.64, 1] as const, times: [0, 0.4, 0.7, 1] };

function SidebarNavItem({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  const Icon = item.icon;
  const iconControls = useAnimationControls();
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      void iconControls.start({ scale: [1, 1.2, 0.94, 1] }, SIDEBAR_ICON_POP);
    }
    wasActive.current = active;
  }, [active, iconControls]);

  return (
    <Link
      href={href}
      className={`mesh-nav-item group relative flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-[0.9375rem] font-medium transition-all duration-150 ${
        active
          ? "mesh-nav-item-active bg-[var(--mesh-panel-hover)] font-semibold text-[var(--mesh-text)]"
          : "text-[var(--mesh-text-secondary)] hover:bg-[var(--mesh-panel-hover)] hover:text-[var(--mesh-text)]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {/* ONE shared indicator (single accent bar, soft glow) that slides and
          stretches between items on route change via framer layoutId. */}
      {active && (
        <motion.span
          layoutId="sidebar-nav-indicator"
          transition={SIDEBAR_INDICATOR_SPRING}
          className="pointer-events-none absolute bottom-[19%] left-0 top-[19%] w-[3px] rounded-r-full"
          style={{ background: "var(--accent)" }}
          aria-hidden="true"
        />
      )}
      <motion.span animate={iconControls} className="relative flex shrink-0">
        <Icon className={`h-[20px] w-[20px] shrink-0 ${active ? "stroke-[2px]" : "stroke-[1.5px]"}`} aria-hidden="true" />
      </motion.span>
      <span data-nav-label className="truncate">{item.label}</span>
    </Link>
  );
}

function ShellTopBar({
  user,
  routeInfo,
  unreadCounts,
}: {
  user: AppShellProps["user"];
  routeInfo: RouteInfo;
  unreadCounts: UnreadCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const accountMenuRef = useRef<HTMLDetailsElement>(null);

  // A native <details> stays open through Next's soft navigation, so the
  // account dropdown would linger after you pick an item. Close it whenever the
  // route changes.
  useEffect(() => {
    accountMenuRef.current?.removeAttribute("open");
  }, [pathname]);

  // Note: Cmd/Ctrl+K is owned by the command palette (which autofocuses after
  // this ran and overrode it) — so no topbar handler here, and no ⌘K badge that
  // would falsely promise to focus this search box.

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  async function shareCurrent() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title: `${routeInfo.title} · mesh.me`, text: routeInfo.description || "mesh.me", url };
    const result = await shareContent(shareData);
    if (result === "copied") {
      addToast("Link copied to clipboard", "success");
    } else if (result === "unsupported") {
      addToast("Sharing isn’t supported here", "info");
    }
  }

  const ownerInitials = (
    user.displayName
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("") || user.username.charAt(0) || "M"
  ).toUpperCase();

  return (
    // Height comes from `.mesh-topbar { min-height: var(--mesh-topbar-h) }` in
    // unlayered CSS, which outranks any min-h-* utility on this element — do
    // not add one; it would read as live and lie.
    <header className="mesh-topbar lg-scroll-edge sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--mesh-border)] bg-[var(--mesh-bg)]/95 px-4 backdrop-blur-xl lg:gap-4 lg:px-6">
      {/* Account dropdown: top-right spring reveal + quick top-down item
          stagger. Bespoke keyframes scoped here; self-guards reduced motion. */}
      <style>{`
        @keyframes meshAcctPanelIn {
          from { opacity: 0; transform: scale(0.96) translateY(-6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes meshAcctItemIn {
          from { opacity: 0; transform: translateY(-7px); }
          to { opacity: 1; transform: translateY(0); }
        }
        details[open] > .mesh-account-panel {
          transform-origin: top right;
          animation: meshAcctPanelIn 260ms var(--mesh-spring) both;
        }
        details[open] > .mesh-account-panel .mesh-account-item {
          animation: meshAcctItemIn 300ms var(--mesh-ease-out) both;
          animation-delay: calc(var(--acc-i, 0) * 38ms + 70ms);
        }
        @media (prefers-reduced-motion: reduce) {
          details[open] > .mesh-account-panel,
          details[open] > .mesh-account-panel .mesh-account-item { animation: none; }
        }
      `}</style>
      <div className="min-w-0 flex-1 lg:flex-none">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[1.25rem] font-semibold tracking-tight text-[var(--mesh-text)] lg:text-xl">{routeInfo.title}</h1>
        </div>
        {/* No subtitle (tone reset R7): a marketing line under every H1 is the
            product captioning itself. routeInfo.description survives only as
            the share-sheet text. */}
      </div>

      <form onSubmit={submitSearch} className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-3.5 py-2 lg:flex">
        <Search className="h-4 w-4 shrink-0 text-[var(--mesh-text-muted)]" aria-hidden="true" />
        <label htmlFor="mesh-topbar-search" className="sr-only">Search your Mesh</label>
        <input
          id="mesh-topbar-search"
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mesh-search-input min-w-0 flex-1 bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
          placeholder="Search your Mesh"
          type="search"
          suppressHydrationWarning
        />
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:gap-2">
        <GhostModeToggle compact initialGhost={user.ghostMode} />
        {/* Three topbar controls, all of them flat before this: `.mesh-topbar-btn`
            was a 1px border over `background: transparent` (globals.css:712-730)
            and `.mesh-topbar-icon` had no background at all (globals.css:694-704)
            — no face, no --edge ring, no side wall, and a hover that only tinted.
            `.key` is added, not substituted: the existing classes still carry the
            geometry (display, gap, padding, size, type) and `.key` at
            globals.css:4942 sits later in the file, so its face / ring / wall /
            press win on source order without one line of new CSS. */}
        <button type="button" onClick={shareCurrent} className="mesh-topbar-btn key hidden items-center gap-2 lg:inline-flex" aria-label="Share this page">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          <span>Share</span>
        </button>
        <Link href="/notifications" className="mesh-topbar-icon key relative" aria-label="Notifications" title="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCounts.unreadNotifications > 0 && (
            /* `text-white` on `bg-[var(--accent)]` was a real contrast failure,
               not a style tic: in Worklight --accent is #93a9ff (tokens.css:194)
               and white on it measures ~1.9:1. --accent-ink is the PINNED ink for
               that fill (tokens.css:69, 197) and is contrast-verified in both
               themes. */
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-micro font-semibold text-[var(--accent-ink)]">
              {unreadCounts.unreadNotifications > 99 ? "99+" : unreadCounts.unreadNotifications}
            </span>
          )}
        </Link>

        <details ref={accountMenuRef} className="relative">
          {/* The account trigger is a real control and had a border on desktop
              and nothing at all on mobile. The Tailwind radius / border / hover
              utilities are DELETED rather than left in place: this file's rules
              are unlayered and Tailwind's utilities live in `@layer utilities`
              (globals.css:1 `@import "tailwindcss"`), so unlayered `.key` beats
              every one of them — leaving them would be dead markup that reads as
              if it still did something. */}
          <summary className="mesh-topbar-owner key flex cursor-pointer list-none items-center gap-2 p-0 text-sm font-semibold text-[var(--mesh-text)] lg:px-3 lg:py-1.5 [&::-webkit-details-marker]:hidden" aria-label="Account menu">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-semibold text-[var(--text-primary)] ring-1 ring-[var(--mesh-border)] lg:hidden" aria-hidden="true">{ownerInitials}</span>
            <span className="hidden max-w-[9rem] truncate lg:inline">{user.displayName}</span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--mesh-text-muted)] lg:block" aria-hidden="true" />
          </summary>
          <div className="mesh-account-panel absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel-solid)] p-2 shadow-lg z-50">
            <div className="flex items-center gap-3 rounded-lg bg-[var(--mesh-bg-elevated)] p-3">
              <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">{user.displayName}</p>
                <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{user.username}</p>
              </div>
            </div>
            <div
              className="mt-2 grid gap-0.5"
              onClick={() => accountMenuRef.current?.removeAttribute("open")}
            >
              <Link href={`/profile/${user.username}`} className="mesh-dropdown-item mesh-account-item" style={{ ["--acc-i" as string]: 0 }}>Profile</Link>
              <Link href="/connected-accounts" className="mesh-dropdown-item mesh-account-item" style={{ ["--acc-i" as string]: 1 }}>One Account</Link>
              <Link href="/settings" className="mesh-dropdown-item mesh-account-item" style={{ ["--acc-i" as string]: 2 }}>Settings</Link>
              <Link href="/search" className="mesh-dropdown-item mesh-account-item lg:hidden" style={{ ["--acc-i" as string]: 3 }}>Search</Link>
              <Link href="/meshpro" className="mesh-dropdown-item mesh-account-item" style={{ ["--acc-i" as string]: 4 }}>MeshPro</Link>
              <button
                type="button"
                className="mesh-dropdown-item mesh-account-item w-full text-left"
                style={{ ["--acc-i" as string]: 5 }}
                onClick={(e) => {
                  (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                  window.dispatchEvent(new CustomEvent("mesh:open-bug-report"));
                }}
              >
                Report a bug
              </button>
              <hr className="mesh-account-item my-1 border-[var(--mesh-border)]" style={{ ["--acc-i" as string]: 6 }} />
              <form action={signOut} className="mesh-account-item" style={{ ["--acc-i" as string]: 7 }}>
                <button type="submit" className="mesh-dropdown-item mesh-dropdown-danger w-full text-left">
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
  const { theme, setMode } = useTheme();
  const routeInfo = useMemo(() => getRouteInfo(pathname, user.username), [pathname, user.username]);

  // Directional route transitions: diff the incoming path against a small
  // history stack so going deeper enters from the right and returning slides in
  // from the left. The route slot exposes this as data-nav-dir, which the shared
  // Mesh Motion CSS reads. Unknown/initial → no direction (neutral rise).
  // Derived during render via React's "adjust state when a prop changes"
  // pattern, so the fresh (keyed) slot carries the direction on its first paint.
  const [navTracker, setNavTracker] = useState<{ path: string; dir: NavDir; history: string[] }>(
    () => ({ path: pathname, dir: undefined, history: [pathname] })
  );
  if (navTracker.path !== pathname) {
    const history = navTracker.history;
    const goingBack = history.length >= 2 && history[history.length - 2] === pathname;
    const prev = history[history.length - 1];
    let dir: NavDir;
    // The Mesh and the Flow are one vertical space: you dive DOWN into the Flow
    // and rise back UP to the Mesh, so that pair transitions vertically instead
    // of the usual horizontal forward/back slide.
    if (prev && isOnMesh(prev) && isOnFlow(pathname)) dir = "dive";
    else if (prev && isOnFlow(prev) && isOnMesh(pathname)) dir = "rise";
    else {
      const prevDepth = prev ? prev.split("/").filter(Boolean).length : 0;
      const nextDepth = pathname.split("/").filter(Boolean).length;
      dir = goingBack || nextDepth < prevDepth ? "back" : "forward";
    }
    const nextHistory = goingBack ? history.slice(0, -1) : [...history, pathname].slice(-24);
    setNavTracker({ path: pathname, dir, history: nextHistory });
  }
  const navDir = navTracker.path === pathname ? navTracker.dir : undefined;
  const isFeedSurface = pathname === "/feed" || pathname.startsWith("/feed/");
  const isMeshSurface = isOnMesh(pathname);
  // The Flow is a full-bleed reel stage: no top bar, no ambient background.
  const isFlowSurface = isOnFlow(pathname);
  // Explore OWNS search. Its own field filters the results in place and works at
  // every width; this top bar's field is desktop-only and goes to /search. Both
  // were on screen at once, 90px apart, both labelled with a magnifier and the
  // word Mesh — two places stating one fact, rendered as two boxes. The page's
  // one stays; this one steps aside there.
  const isExploreSurface = pathname === "/explore" || pathname.startsWith("/explore/");
  // MeChat is a split view that owns its height — a chat never scrolls the
  // page. `mesh-shell-chat` gives it the same full-bleed content column the
  // canvas surfaces use (and only that; see globals.css at the shared rule).
  const isMessagesSurface = pathname === "/messages" || pathname.startsWith("/messages/");
  const userInitials = useMemo(() => {
    const fromName = user.displayName
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("");
    return (fromName || user.username.charAt(0) || "M").toUpperCase();
  }, [user.displayName, user.username]);
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
    const intervalId = window.setInterval(loadUnreadCounts, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadUnreadCounts();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Re-run on route change too, so the nav badges refresh the instant you
    // read notifications/messages instead of lagging up to the 60s interval.
  }, [pathname]);

  // Presence heartbeat from every surface: your Meshi represents you across
  // mesh.me, so being active in MeChat, the Flow, or anywhere else keeps you
  // "online" for your people. The mesh page runs its own richer heartbeat
  // (cursor position, moods), so this one stands down there.
  useEffect(() => {
    if (isMeshSurface) return;
    let cancelled = false;

    const heartbeat = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      let meshi: Record<string, string> = {};
      try {
        meshi = {
          meshiColor: localStorage.getItem("meshiColor") || "blue",
          meshiHat: localStorage.getItem("meshiHat") || "none",
          meshiHair: localStorage.getItem("meshiHair") || "none",
          meshiAccessory: localStorage.getItem("meshiAccessory") || "none",
          meshiEyeStyle: localStorage.getItem("meshiEye") || "regular",
          meshiBadge: localStorage.getItem("meshiBadge") || "none",
        };
      } catch {
        // storage unavailable — defaults are fine
      }
      const ghostMode = readGhostMode();
      // The where-chip opt-in rides every surface's heartbeat; the server
      // redacts activeRoute/viewingMesh for anyone who hasn't opted in.
      const shareWhere = readWhereShare();
      void fetch("/api/mesh/presence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...meshi, surface: "feed", activeRoute: pathname, ghostMode, shareWhere }),
      }).catch(() => {});
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isMeshSurface, pathname]);

  return (
    <div className={`mesh-shell h-dvh max-h-dvh min-h-0 overflow-hidden text-[var(--mesh-text)] md:grid md:grid-cols-[var(--mesh-sidebar-width)_1fr] ${isFeedSurface ? "mesh-shell-feed" : ""} ${isMeshSurface || isFlowSurface ? "mesh-shell-mesh" : ""} ${isMessagesSurface ? "mesh-shell-chat" : ""} ${isFlowSurface ? "mesh-shell-flow" : ""} ${isExploreSurface ? "mesh-shell-explore" : ""}`}>

      {/* The per-item static active bar is superseded by the shared morphing
          indicator rendered inside the active SidebarNavItem. */}
      <style>{`.mesh-sidebar .mesh-nav-item-active::before { display: none !important; }`}</style>

      {/* Sidebar */}
      <aside className="mesh-sidebar hidden h-dvh flex-col border-r border-[var(--mesh-border)] bg-[var(--mesh-bg)] md:flex">
        {/* Brand */}
        <div className="px-5 pt-5 pb-6">
          <MeshiBrandLockup
            href="/mesh"
            size={30}
            label="mesh.me"
            className="text-lg"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Primary navigation">
          <div className="space-y-0.5">
            {primaryNavItems.map((item) => {
              const href = resolveNavHref(item.href, user.username);
              const active = isNavItemActive(pathname, item.href, user.username);

              return <SidebarNavItem key={item.href} item={item} href={href} active={active} />;
            })}
          </div>
        </nav>

        {/* Privacy First (discreet) */}
        <div className="mesh-privacy-card mx-3 mb-2">
          <Link
            href="/settings#privacy"
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel-hover)] hover:text-[var(--mesh-text-secondary)]"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
            {/* `text-micro`, not `text-xs`: this is a persistent quiet badge, which is
                exactly what the micro step is the floor for. At the caption step the
                sentence no longer fits the 16rem rail and truncated to "…you own your
                d…", which is a worse outcome than one step smaller. */}
            <span className="min-w-0 flex-1 truncate text-micro font-medium">Privacy first — you own your data</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          </Link>
        </div>

        {/* User Dock */}
        <div className="mx-3 mb-3">
          {/* The user dock navigates to your profile, so it is a key, not a card.
              It was a --paper-1 fill inside a 1px --rule border: no --edge ring
              (so no WCAG 1.4.11 boundary), no wall, and `.mesh-user-dock:hover`
              (globals.css:684) only swapped the fill. The Tailwind fill / border
              / radius utilities are removed for the same reason as above — `.key`
              (globals.css:4942) already owns all three. */}
          <Link
            href={`/profile/${user.username}`}
            className="mesh-user-dock key flex items-center gap-2.5 px-3.5 py-3"
            aria-label="Open your profile"
          >
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.displayName}
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[var(--mesh-border)]"
              />
            ) : (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-semibold text-[var(--text-primary)] ring-1 ring-[var(--mesh-border)]"
                aria-hidden="true"
              >
                {userInitials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">{user.displayName}</p>
              <p className="truncate text-micro text-[var(--mesh-text-muted)]">@{user.username}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--mesh-text-muted)]" aria-hidden="true" />
          </Link>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--mesh-border)] px-5 py-3">
          <div className="text-micro text-[var(--mesh-text-muted)]">
            <p suppressHydrationWarning>© {new Date().getFullYear()} Mesh.me</p>
            <p>All rights reserved</p>
          </div>
          {/* Two footer controls. The theme toggle carried `.mesh-pressable`,
              which is the OLD paper model: `translateY(-2px)` plus a wide blurred
              shadow on hover (globals.css:2201-2204). It is REMOVED, not joined
              by `.key` — `.mesh-pressable:hover` sets `box-shadow`, so keeping it
              would have overridden the key's own side wall the moment the pointer
              arrived, and the object would have grown instead of pressing in. The
              settings link had no class at all beyond a radius and a text colour.
              Both are keys now. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode(theme === "dark" ? "light" : "dark")}
              className="key inline-flex items-center justify-center p-1.5 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link href="/settings" className="key inline-flex items-center justify-center p-1.5 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)]" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`mesh-main flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 ${isMeshSurface ? "mesh-main-mesh" : ""}`}>
        {!isFlowSurface && <ShellTopBar user={user} routeInfo={routeInfo} unreadCounts={unreadCounts} />}

        <div className="mesh-content flex-1 overflow-y-auto">
          <div key={pathname} className="mesh-route-slot animate-page-enter" data-nav-dir={navDir}>
            {children}
          </div>
        </div>
      </main>

      {/* The Mesh and the Flow are one vertical space. A quiet handle on each
          dives down into the Flow / rises back up to the Mesh; the route slot
          animates vertically to match (see data-nav-dir dive/rise). */}
      {/* The two continuum handles are the only way in and out of the Flow, and
          they were a translucent `color-mix` pill with `backdrop-filter:
          blur(10px)` and a hardcoded `0 8px 24px rgba(0,0,0,0.28)`
          (globals.css:1005-1030) — a banned blur, a hardcoded shadow, no --edge
          ring and no wall. `.key` supplies all of it; the three declarations that
          `.key` does not reach (the blur, the pill radius, and the hover
          `translateY` that made the handle drift under the pointer) are in the
          CSS this pass hands back. The centering `transform: translateX(-50%)`
          survives untouched, which is exactly why `.key:active` uses `translate`
          and never `transform`. */}
      {isMeshSurface && (
        <Link href="/flow" className="mesh-continuum-handle mesh-continuum-handle-down key" aria-label="Dive into the Flow">
          <span>Flow</span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
      {isFlowSurface && (
        <Link href="/mesh" className="mesh-continuum-handle mesh-continuum-handle-up key" aria-label="Back to the Mesh">
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Mesh</span>
        </Link>
      )}

      <MobileNav username={user.username} unreadMessages={unreadCounts.unreadMessages} unreadNotifications={unreadCounts.unreadNotifications} />
      <CommandPalette username={user.username} />
      <KeyboardShortcutsOverlay username={user.username} />
    </div>
  );
}
