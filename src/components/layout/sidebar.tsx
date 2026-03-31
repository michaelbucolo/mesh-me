"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageCircle,
  Bell,
  User,
  PenSquare,
  Settings,
  LogOut,
  Waypoints,
  Compass,
  Users,
  Shield,
  Crown,
  MessageSquarePlus,
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

// 6 primary tabs: Mesh, Explore, Feed, Messages, Profile, MeshPro
const navItems = [
  { href: "/mesh", icon: Waypoints, label: "The Mesh", gradient: "from-blue-500 to-cyan-400" },
  { href: "/explore", icon: Compass, label: "Explore", gradient: "from-sky-500 to-blue-400" },
  { href: "/feed", icon: Home, label: "Feed", gradient: "from-blue-500 to-sky-400" },
  { href: "/messages", icon: MessageCircle, label: "Messages", gradient: "from-emerald-500 to-teal-400" },
  { href: "/profile", icon: User, label: "Profile", gradient: "from-violet-500 to-purple-400" },
  { href: "/meshpro", icon: Crown, label: "MeshPro", gradient: "from-amber-500 to-yellow-400" },
];

const secondaryItems = [
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/connected-accounts", icon: Waypoints, label: "Connected Accounts" },
];

export function Sidebar({ user, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside data-meshi-zone="sidebar" className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass-panel" style={{ borderRight: "1px solid var(--glass-border)", borderLeft: "none", borderTop: "none", borderBottom: "none" }}>
      {/* Logo + Notification Bell */}
      <div className="p-6 flex items-center justify-between">
        <Link href="/mesh" className="group flex items-center gap-2.5">
          <MeshiLogo size={32} color="blue" mood="happy" />
          <span className="brand-wordmark text-xl" style={{ color: "var(--text-primary)" }}>
            mesh<span className="brand-wordmark-accent">.me</span>
          </span>
        </Link>
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Bell className="h-5 w-5" style={{ color: pathname.startsWith("/notifications") ? "var(--accent)" : "var(--text-muted)" }} />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-white text-[9px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1" style={{ background: "#ef4444" }}>
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Link>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const actualHref = item.href === "/profile" ? `/profile/${user.username}` : item.href;
            const isActive = item.href === "/profile"
              ? pathname.includes("/profile/")
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={actualHref}
                className={cn(
                  "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300",
                  isActive
                    ? "bg-gradient-to-r " + item.gradient + " text-white shadow-lg shadow-blue-500/20"
                    : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <item.icon className={cn("h-5 w-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-105")} />
                <span>{item.label}</span>
                {item.href === "/messages" && unreadNotifications > 0 && (
                  <span className="ml-auto text-white text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1" style={{ background: isActive ? "rgba(255,255,255,0.3)" : "var(--accent)" }}>
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Create Post */}
        <div className="mt-4">
          <Link
            href="/feed?compose=true"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white font-semibold text-sm shadow-lg active:scale-[0.97] transition-all brand-button hover:shadow-xl hover:shadow-blue-500/25"
          >
            <PenSquare className="h-4 w-4" />
            <span>Create Post</span>
          </Link>
        </div>

        {/* Secondary navigation */}
        <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">More</p>
          <div className="space-y-0.5">
            {secondaryItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {user.isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                  pathname.startsWith("/admin")
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin</span>
              </Link>
            )}

            <Link
              href="/feedback"
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                pathname.startsWith("/feedback")
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span>Feedback</span>
            </Link>

            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                pathname.startsWith("/settings")
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* User section */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.displayName}</p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <Link
            href="/settings"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs hover:text-red-400 transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
