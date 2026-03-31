"use client";

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

// 4 core tabs — everything else lives in Meshi command center
const navItems = [
  { href: "/mesh", icon: Waypoints, label: "The Mesh", gradient: "from-blue-500 to-cyan-400" },
  { href: "/feed", icon: MessageCircle, label: "Feed", gradient: "from-emerald-500 to-teal-400" },
  { href: "/notifications", icon: Bell, label: "Notifications", gradient: "from-amber-500 to-orange-400" },
  { href: "/profile", icon: User, label: "Profile", gradient: "from-violet-500 to-purple-400" },
];

export function Sidebar({ user, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside data-meshi-zone="sidebar" className="hidden lg:flex flex-col w-60 h-screen sticky top-0 glass-panel" style={{ borderRight: "1px solid var(--glass-border)", borderLeft: "none", borderTop: "none", borderBottom: "none" }}>
      {/* Logo */}
      <div className="p-5 pb-3">
        <Link href="/mesh" className="group flex items-center gap-2.5">
          <div className="relative">
            <MeshiLogo size={32} color="blue" mood="happy" />
            <span className="absolute -top-1 -right-2 px-1 py-0.5 rounded text-[6px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)", lineHeight: 1 }}>Beta</span>
          </div>
          <span className="brand-wordmark text-xl" style={{ color: "var(--text-primary)" }}>
            mesh<span className="brand-wordmark-accent">.me</span>
          </span>
        </Link>
        <p className="text-[11px] mt-2 ml-1" style={{ color: "var(--text-muted)" }}>
          Your digital universe
        </p>
      </div>

      {/* Primary Navigation — clean, minimal */}
      <nav className="flex-1 px-3 mt-2">
        <div className="space-y-1">
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
                  "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300",
                  isActive
                    ? "bg-gradient-to-r " + item.gradient + " text-white shadow-lg shadow-blue-500/20"
                    : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <item.icon className={cn("h-5 w-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-105")} />
                <span>{item.label}</span>
                {item.href === "/notifications" && unreadNotifications > 0 && (
                  <span className="ml-auto text-white text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1" style={{ background: isActive ? "rgba(255,255,255,0.3)" : "#ef4444" }}>
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Meshi hint */}
        <div className="mt-8 mx-3 p-3 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
          <p className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Need something?
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Click Meshi (bottom right) for search, settings, communities, and more.
          </p>
        </div>

        {/* Admin link (only for admins) */}
        {user.isAdmin && (
          <div className="mt-4 px-1">
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
          </div>
        )}
      </nav>

      {/* User section — minimal */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.displayName}</p>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="p-2 rounded-lg hover:text-red-400 transition-colors"
              style={{ color: "var(--text-muted)" }}
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
