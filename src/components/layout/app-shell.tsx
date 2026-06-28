"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { signOut } from "@/lib/actions";
import { getRouteLoadingPersonality } from "@/lib/loading-personality";
import { MeshiBrandLockup, UserMeshiBadge } from "@/components/meshi/meshi-identity";
import { CommandPalette } from "@/components/layout/command-palette";
import { KeyboardShortcutsOverlay } from "@/components/layout/keyboard-shortcuts-overlay";
import { MobileNav } from "@/components/layout/mobile-nav";
import { WhatsNewDrawer } from "@/components/layout/whats-new-drawer";
import { sidebarNavItems, resolveNavHref, isNavItemActive } from "@/components/layout/navigation-config";

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

type UnreadCounts = {
  unreadNotifications: number;
  unreadMessages: number;
};

type RouteInfo = {
  title: string;
  description: string;
};

const routeInfoMap: Record<string, RouteInfo> = {
  "/mesh": { title: "The Mesh", description: "Your digital world. Connected by you." },
  "/feed": { title: "Feed", description: "Your timeline across all connected platforms." },
  "/messages": { title: "MeChat", description: "Your universal messaging hub. All your conversations, in one place." },
  "/notifications": { title: "Notifications", description: "Stay updated on what matters." },
  "/search": { title: "Search", description: "Find people, posts, and communities." },
  "/communities": { title: "Communities", description: "Discover, join, and build with communities around the world." },
  "/spaces": { title: "Spaces", description: "Shared areas for collaboration and creativity." },
  "/connected-accounts": { title: "Connections", description: "Manage your connected platforms and accounts." },
  "/vault": { title: "Vault", description: "Your private archive. Saved and secure." },
  "/trust": { title: "Verify", description: "Identity verification and trust management." },
  "/settings": { title: "Settings", description: "Configure your Mesh.me experience." },
  "/analytics": { title: "Analytics", description: "Understand your digital footprint." },
  "/explore": { title: "Explore", description: "Discover new content, people, and communities." },
  "/privacy-controls": { title: "Privacy", description: "Control your data, permissions, and visibility." },
  "/meshpro": { title: "Mesh Pro", description: "Unlock deeper analytics and richer personalization." },
  "/content-hub": { title: "Content Hub", description: "Manage and organize your content." },
  "/innovation": { title: "Create", description: "Publish and share with your world." },
  "/marketplace": { title: "Marketplace", description: "Creator tools and privacy-first upgrades." },
  "/feature-requests": { title: "Ideas", description: "Submit and vote on product ideas." },
  "/meshi-voice": { title: "Meshi Voice", description: "Talk to your companion." },
  "/super-app": { title: "Super App", description: "Track which workflows Mesh.me replaces." },
  "/billing": { title: "Billing", description: "Manage your subscription and payments." },
  "/feedback": { title: "Feedback", description: "Share your thoughts with us." },
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
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
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
    <header className="mesh-topbar sticky top-0 z-30 flex min-h-[72px] items-center gap-4 border-b border-[var(--mesh-border)] bg-[var(--mesh-bg)]/95 px-6 backdrop-blur-xl">
      <div className="min-w-0 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--mesh-text)]">{routeInfo.title}</h1>
          <button type="button" className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--mesh-border)] text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)] transition-colors" aria-label="Page info">
            <span className="text-xs">ⓘ</span>
          </button>
        </div>
        {routeInfo.description && (
          <p className="mt-0.5 text-sm text-[var(--mesh-text-muted)]">{routeInfo.description}</p>
        )}
      </div>

      <form onSubmit={submitSearch} className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel)] px-3.5 py-2 lg:flex">
        <Search className="h-4 w-4 shrink-0 text-[var(--mesh-text-muted)]" aria-hidden="true" />
        <label htmlFor="mesh-topbar-search" className="sr-only">Search your Mesh</label>
        <input
          id="mesh-topbar-search"
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
          placeholder="Search your Mesh"
          type="search"
        />
        <kbd className="hidden rounded-md border border-[var(--mesh-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mesh-text-muted)] sm:inline-flex">⌘ K</kbd>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link href="/search" className="mesh-topbar-icon lg:hidden" aria-label="Search" title="Search">
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button type="button" className="mesh-topbar-btn hidden items-center gap-2 lg:inline-flex" aria-label="Share">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          <span>Share</span>
        </button>
        <Link href="/trust" className="mesh-topbar-icon" aria-label="Trust and verification" title="Verify">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link href="/notifications" className="mesh-topbar-icon relative" aria-label="Notifications" title="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCounts.unreadNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--mesh-blue)] px-1 text-[9px] font-bold text-white">
              {unreadCounts.unreadNotifications > 99 ? "99+" : unreadCounts.unreadNotifications}
            </span>
          )}
        </Link>

        <details className="relative">
          <summary className="mesh-topbar-owner flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--mesh-border)] px-3 py-1.5 text-sm font-semibold text-[var(--mesh-text)] hover:bg-[var(--mesh-panel-hover)] transition-colors [&::-webkit-details-marker]:hidden" aria-label="Account menu">
            <span>Owner</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--mesh-text-muted)]" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-panel-solid)] p-2 shadow-lg z-50">
            <div className="flex items-center gap-3 rounded-lg bg-[var(--mesh-bg-elevated)] p-3">
              <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--mesh-text)]">{user.displayName}</p>
                <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{user.username}</p>
              </div>
            </div>
            <div className="mt-2 grid gap-0.5">
              <Link href={`/profile/${user.username}`} className="mesh-dropdown-item">Profile</Link>
              <Link href="/settings" className="mesh-dropdown-item">Settings</Link>
              <Link href="/privacy-controls" className="mesh-dropdown-item">Privacy Controls</Link>
              <Link href="/meshpro" className="mesh-dropdown-item">Mesh Pro</Link>
              <hr className="my-1 border-[var(--mesh-border)]" />
              <form action={signOut}>
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
  const routeInfo = useMemo(() => getRouteInfo(pathname, user.username), [pathname, user.username]);
  const isFeedSurface = pathname === "/feed" || pathname.startsWith("/feed/");
  const isMeshSurface = pathname === "/mesh" || pathname.startsWith("/mesh/");
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

  return (
    <div className={`mesh-shell h-dvh max-h-dvh min-h-0 overflow-hidden text-[var(--mesh-text)] md:grid md:grid-cols-[var(--mesh-sidebar-width)_1fr] ${isFeedSurface ? "mesh-shell-feed" : ""} ${isMeshSurface ? "mesh-shell-mesh" : ""}`}>
      <AppRouteProgress pathname={pathname} />

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
            {sidebarNavItems.map((item) => {
              const href = resolveNavHref(item.href, user.username);
              const active = isNavItemActive(pathname, item.href, user.username);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`mesh-nav-item group flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition-all duration-150 ${
                    active
                      ? "mesh-nav-item-active bg-[var(--mesh-panel-hover)] font-semibold text-[var(--mesh-text)]"
                      : "text-[var(--mesh-text-secondary)] hover:bg-[var(--mesh-panel-hover)] hover:text-[var(--mesh-text)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={`h-[20px] w-[20px] shrink-0 ${active ? "stroke-[2px]" : "stroke-[1.5px]"}`} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Privacy First Card */}
        <div className="mx-3 mb-3">
          <div className="mesh-privacy-card rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-4">
            <div className="flex items-center gap-2 text-[var(--mesh-blue)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-bold">Privacy First</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--mesh-text-muted)]">
              You own your data.<br />
              We protect your privacy.<br />
              Always.
            </p>
            <Link href="/privacy-controls" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--mesh-text-secondary)] hover:text-[var(--mesh-text)] transition-colors">
              Learn how <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* User Dock */}
        <div className="mx-3 mb-3">
          <div className="mesh-user-dock flex items-center gap-2.5 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3.5 py-3">
            <UserMeshiBadge displayName={user.displayName} username={user.username} compact size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">{user.displayName}</p>
              <p className="truncate text-[11px] text-[var(--mesh-text-muted)]">@{user.username}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--mesh-text-muted)]" aria-hidden="true" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--mesh-border)] px-5 py-3">
          <div className="text-[10px] text-[var(--mesh-text-muted)]">
            <p>© 2025 Mesh.me</p>
            <p>All rights reserved</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-lg p-1.5 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)] transition-colors" aria-label="Toggle theme">
              <Sun className="h-4 w-4" />
            </button>
            <Link href="/settings" className="rounded-lg p-1.5 text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text-secondary)] transition-colors" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`mesh-main flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 ${isMeshSurface ? "mesh-main-mesh" : ""}`}>
        <ShellTopBar user={user} routeInfo={routeInfo} unreadCounts={unreadCounts} />

        <div className="mesh-content flex-1 overflow-y-auto">
          <div key={pathname} className="mesh-route-slot animate-page-enter">
            {children}
          </div>
        </div>
      </main>

      <MobileNav username={user.username} unreadMessages={unreadCounts.unreadMessages} unreadNotifications={unreadCounts.unreadNotifications} />
      <WhatsNewDrawer userId={user.id} />
      <CommandPalette username={user.username} />
      <KeyboardShortcutsOverlay username={user.username} />
    </div>
  );
}
