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
  Search,
  Compass,
  Users,
  Shield,
  ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";
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

// Only 3 primary tabs — everything else is accessible from the mesh or secondary nav
const navItems = [
  { href: "/mesh", icon: Waypoints, label: "The Mesh", gradient: "from-blue-500 to-cyan-400" },
  { href: "/feed", icon: Home, label: "Feed", gradient: "from-violet-500 to-pink-400" },
  { href: "/messages", icon: MessageCircle, label: "Messages", gradient: "from-emerald-500 to-teal-400" },
];

const secondaryItems = [
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/search", icon: Search, label: "Search" },
];

export function Sidebar({ user, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { mode, setMode } = useTheme();

  return (
    <aside data-meshi-zone="sidebar" className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass-panel" style={{ borderRight: "1px solid var(--glass-border)", borderLeft: "none", borderTop: "none", borderBottom: "none" }}>
      {/* Logo — Meshi is the brand mascot */}
      <div className="p-6">
        <Link href="/mesh" className="group flex items-center gap-2.5">
          <MeshiLogo size={32} color="blue" mood="happy" />
          <span className="brand-wordmark text-xl" style={{ color: "var(--text-primary)" }}>
            mesh<span className="brand-wordmark-accent">.me</span>
          </span>
        </Link>
      </div>

      {/* Primary Navigation — 3 tabs */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white font-semibold text-sm shadow-lg active:scale-[0.97] transition-all bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 hover:shadow-xl hover:shadow-violet-500/25"
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
                  {item.href === "/notifications" && unreadNotifications > 0 && (
                    <span className="ml-auto text-white text-[9px] rounded-full h-4 min-w-4 flex items-center justify-center px-1" style={{ background: "#ef4444" }}>
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </Link>
              );
            })}

            <Link
              href={`/profile/${user.username}`}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                pathname.includes(`/profile/${user.username}`)
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <User className="h-3.5 w-3.5" />
              <span>Profile</span>
            </Link>

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

      {/* Theme Toggle */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg-tertiary)" }}>
          {([{ v: "light" as const, icon: Sun, l: "Light" }, { v: "dark" as const, icon: Moon, l: "Dark" }, { v: "system" as const, icon: Monitor, l: "Auto" }]).map((m) => (
            <button key={m.v} onClick={() => setMode(m.v)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m.v ? "shadow-sm" : "opacity-60 hover:opacity-100"}`}
              style={mode === m.v ? { background: "var(--bg-elevated)", color: "var(--text-primary)" } : { color: "var(--text-secondary)" }}>
              <m.icon className="h-3.5 w-3.5" />{m.l}
            </button>
          ))}
        </div>
      </div>

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
