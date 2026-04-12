"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  MessagesSquare,
  Bell,
  User,
  LogOut,
  Waypoints,
  Shield,
  Globe,
  Sparkles,
  ArrowRight,
  Compass,
  Settings,
  Link2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

interface SidebarProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  unreadNotifications?: number;
}

const navItems = [
  { href: "/mesh", icon: Waypoints, label: "The Mesh" },
  { href: "/content-hub", icon: Globe, label: "Content Hub" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/feed", icon: MessageCircle, label: "Feed" },
  { href: "/messages", icon: MessagesSquare, label: "MeChat" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/connected-accounts", icon: Link2, label: "Connected Accounts" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ user, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [showGettingStarted, setShowGettingStarted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("sidebar-getting-started-dismissed");
  });

  const dismissGettingStarted = () => {
    setShowGettingStarted(false);
    localStorage.setItem("sidebar-getting-started-dismissed", "true");
  };

  return (
    <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-5 backdrop-blur-2xl lg:flex">
      <div className="mb-5 rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
        <Link href="/mesh" className="group flex items-center gap-3">
          <div className="relative">
            <MeshiLogo size={34} color="blue" mood="happy" />
            <span className="absolute -right-2 -top-1 rounded bg-[var(--accent)] px-1 py-0.5 text-[8px] font-bold uppercase leading-none text-white">New</span>
          </div>
          <div>
            <p className="brand-wordmark text-xl text-[var(--text-primary)]">
              mesh<span className="brand-wordmark-accent">.me</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">Digital operating system</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const actualHref = item.href === "/profile" ? `/profile/${user.username}` : item.href;
          const isActive = item.href === "/profile"
            ? pathname.includes(`/profile/${user.username}`)
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={actualHref}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-[var(--accent)]")} />
              <span>{item.label}</span>
              {item.href === "/notifications" && unreadNotifications > 0 && (
                <span className="notif-dot ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}

        {user.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition",
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

      {showGettingStarted && (
        <div className="mb-3 rounded-2xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)] p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">New here?</p>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            Start with <strong>The Mesh</strong>, then publish in <strong>Feed</strong>, and open Meshi for quick commands.
          </p>
          <button
            onClick={dismissGettingStarted}
            className="mt-2 text-[10px] font-medium text-[var(--accent)]"
          >
            Dismiss tip
          </button>
        </div>
      )}

      {showGettingStarted === false && (
        <Link
          href="/onboarding"
          className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3 text-[11px] text-[var(--text-secondary)] transition hover:border-[var(--border-hover)]"
        >
          <span>Revisit onboarding</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      <div className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3">
        <div className="flex items-center gap-3">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{user.displayName}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">@{user.username}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
