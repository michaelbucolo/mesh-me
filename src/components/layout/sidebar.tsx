"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Compass,
  MessageCircle,
  Users,
  Bell,
  User,
  Search,
  PenSquare,
  Settings,
  LogOut,
  Shield,
  Waypoints,
  LayoutGrid,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";

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
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/custom-feed", icon: LayoutGrid, label: "Custom Feed" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/messages", icon: MessageCircle, label: "MeChat" },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
];

export function Sidebar({ user, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { mode, setMode } = useTheme();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass-panel" style={{ borderRight: "1px solid var(--glass-border)", borderLeft: "none", borderTop: "none", borderBottom: "none" }}>
      {/* Logo */}
      <div className="p-6">
        <Link href="/mesh" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">m</span>
          </div>
          <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            mesh<span className="text-blue-500">.me</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-500/10 text-blue-400 nav-active"
                  : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span style={!pathname.startsWith(item.href) ? { color: "var(--text-secondary)" } : undefined}>{item.label}</span>
              {item.href === "/notifications" && unreadNotifications > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1.5 notif-dot">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}

        <Link
          href={`/profile/${user.username}`}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            pathname.includes(`/profile/${user.username}`)
              ? "bg-blue-500/10 text-blue-400 nav-active"
              : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          )}
        >
          <User className="h-5 w-5" />
          <span>Profile</span>
        </Link>

        {user.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              pathname.startsWith("/admin")
                ? "bg-blue-500/10 text-blue-400 nav-active"
                : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
          >
            <Shield className="h-5 w-5" />
            <span>Admin</span>
          </Link>
        )}

        {/* Create Post Button */}
        <div className="pt-4 space-y-2">
          <Link
            href="/feed?compose=true"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium text-sm hover:from-blue-500 hover:to-blue-400 transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-[0.97]"
          >
            <PenSquare className="h-4 w-4" />
            <span>Create Post</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[var(--text-secondary)] text-xs hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </Link>
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
