"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Bell,
  User,
  LogOut,
  Waypoints,
  Shield,
  Globe,
  Sparkles,
  Compass,
  Settings,
  Link2,
  Users,
  Search,
  Rss,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

interface SidebarProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  unreadNotifications?: number;
  unreadMessages?: number;
}

const navItems = [
  { href: "/mesh", icon: Waypoints, label: "The Mesh" },
  { href: "/feed", icon: Rss, label: "Feed" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" as const },
  { href: "/notifications", icon: Bell, label: "Notifications", badgeKey: "notifications" as const },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/content-hub", icon: Globe, label: "Content Hub" },
  { href: "/connected-accounts", icon: Link2, label: "Connected Accounts" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ user, unreadNotifications = 0, unreadMessages = 0 }: SidebarProps) {
  const pathname = usePathname();
  const meshiPrefs = useMeshiPreferences();
  const [showGettingStarted, setShowGettingStarted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("sidebar-getting-started-dismissed");
  });

  const dismissGettingStarted = () => {
    setShowGettingStarted(false);
    localStorage.setItem("sidebar-getting-started-dismissed", "true");
  };

  const getBadgeCount = (key?: "messages" | "notifications") => {
    if (key === "messages") return unreadMessages;
    if (key === "notifications") return unreadNotifications;
    return 0;
  };

  return (
    <aside className="hidden h-screen w-[17rem] shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-4 backdrop-blur-2xl lg:flex">
      {/* Brand */}
      <div className="mb-4 rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3.5">
        <Link href="/mesh" className="group flex items-center gap-3">
          <div className="relative">
            <MeshiMascot size={32} color={meshiPrefs.color} mood={meshiPrefs.face} hat={meshiPrefs.hat} animate showGlow={false} bouncy />
          </div>
          <div>
            <p className="brand-wordmark text-lg text-[var(--text-primary)]">
              mesh<span className="brand-wordmark-accent">.me</span>
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Your digital universe</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const actualHref = item.href === "/profile" ? `/profile/${user.username}` : item.href;
          const isActive = item.href === "/profile"
            ? pathname.includes(`/profile/${user.username}`)
            : pathname.startsWith(item.href);
          const badgeCount = getBadgeCount(item.badgeKey);

          return (
            <Link
              key={item.href}
              href={actualHref}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className={cn("h-[17px] w-[17px] shrink-0", isActive && "text-[var(--accent)]")} />
              <span className="truncate">{item.label}</span>
              {badgeCount > 0 && (
                <span className="notif-dot ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}

        {user.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition",
              pathname.startsWith("/admin")
                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Admin Console</span>
          </Link>
        )}
      </nav>

      {/* Getting started tip */}
      {showGettingStarted && (
        <div className="mb-3 rounded-2xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)] p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Getting started</p>
          </div>
          <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
            Start at <strong>The Mesh</strong> to see your constellation, then explore <strong>Feed</strong> and <strong>Communities</strong>. Click Meshi anytime for help!
          </p>
          <button
            onClick={dismissGettingStarted}
            className="mt-2 text-[10px] font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            Got it
          </button>
        </div>
      )}

      {/* User card */}
      <div className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3">
        <div className="flex items-center gap-2.5">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{user.displayName}</p>
            <p className="truncate text-[10px] text-[var(--text-muted)]">@{user.username}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
