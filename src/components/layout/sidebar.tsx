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
  Globe,
  Shield,
  Home,
  Users,
  Settings,
  Search,
  Command,
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
  onOpenMeshi?: () => void;
}

const mainNav = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/mesh", icon: Waypoints, label: "The Mesh" },
  { href: "/feed", icon: MessageCircle, label: "Feed" },
  { href: "/content-hub", icon: Globe, label: "Content Hub" },
  { href: "/connected-accounts", icon: Link2, label: "Platforms" },
];

const secondaryNav = [
  { href: "/messages", icon: MessageCircle, label: "Messages" },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/notifications", icon: Bell, label: "Notifications", badge: true },
];

export function Sidebar({ user, unreadNotifications = 0, onOpenMeshi }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 glass-panel transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
      style={{ borderRight: "1px solid var(--glass-border)" }}
    >
      {/* Logo */}
      <div className={cn("p-4", collapsed ? "px-3" : "px-5")}>
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <MeshiLogo size={30} color="blue" mood="happy" />
          </div>
          {!collapsed && (
            <span className="brand-wordmark text-lg" style={{ color: "var(--text-primary)" }}>
              mesh<span className="brand-wordmark-accent">.me</span>
            </span>
          )}
        </Link>
      </div>

      {/* Meshi Command Trigger */}
      <div className={cn("px-3 mb-2", collapsed && "px-2")}>
        <button
          onClick={onOpenMeshi}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl text-sm transition-all duration-200 press-scale",
            collapsed ? "justify-center p-2.5" : "px-3 py-2.5"
          )}
          style={{
            background: "var(--accent-muted)",
            border: "1px solid var(--accent-muted)",
            color: "var(--text-secondary)",
          }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-xs">Ask Meshi anything...</span>
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto">
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center p-2.5" : "px-3 py-2",
                  isActive
                    ? "nav-active text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                )}
                style={isActive ? { background: "var(--accent-muted)" } : undefined}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0 transition-colors", isActive && "text-[var(--accent)]")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className="my-3 mx-2" style={{ borderTop: "1px solid var(--border-secondary)" }} />

        <div className="space-y-0.5">
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center p-2.5" : "px-3 py-2",
                  isActive
                    ? "nav-active text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                )}
                style={isActive ? { background: "var(--accent-muted)" } : undefined}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0 transition-colors", isActive && "text-[var(--accent)]")} />
                {!collapsed && <span>{item.label}</span>}
                {item.badge && unreadNotifications > 0 && (
                  <span className="ml-auto text-white text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1" style={{ background: "#ef4444" }}>
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}

          <Link
            href={`/profile/${user.username}`}
            className={cn(
              "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
              collapsed ? "justify-center p-2.5" : "px-3 py-2",
              pathname.includes(`/profile/${user.username}`)
                ? "nav-active text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            )}
            style={pathname.includes(`/profile/${user.username}`) ? { background: "var(--accent-muted)" } : undefined}
          >
            <User className={cn("h-[18px] w-[18px] flex-shrink-0 transition-colors", pathname.includes(`/profile/${user.username}`) && "text-[var(--accent)]")} />
            {!collapsed && <span>Profile</span>}
          </Link>

          <Link
            href="/settings"
            className={cn(
              "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
              collapsed ? "justify-center p-2.5" : "px-3 py-2",
              pathname.startsWith("/settings")
                ? "nav-active text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            )}
            style={pathname.startsWith("/settings") ? { background: "var(--accent-muted)" } : undefined}
          >
            <Settings className={cn("h-[18px] w-[18px] flex-shrink-0 transition-colors", pathname.startsWith("/settings") && "text-[var(--accent)]")} />
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>

        {user.isAdmin && (
          <div className="mt-3">
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-xl text-xs font-medium transition-all duration-200",
                collapsed ? "justify-center p-2.5" : "px-3 py-2",
                pathname.startsWith("/admin")
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <Shield className="h-3.5 w-3.5 flex-shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border-secondary)" }}>
        <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-2 py-1.5")}>
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.displayName}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
              </div>
              <form action={signOut}>
                <button type="submit" className="p-1.5 rounded-lg hover:text-red-400 transition-colors" style={{ color: "var(--text-muted)" }} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
