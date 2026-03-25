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
  Link2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

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
  { href: "/feed", icon: Home, label: "Home" },
  { href: "/mesh", icon: Waypoints, label: "The Mesh" },
  { href: "/custom-feed", icon: LayoutGrid, label: "Custom Feed" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/messages", icon: MessageCircle, label: "MeChat" },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/connected-accounts", icon: Link2, label: "Connected" },
];

export function Sidebar({ user, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-zinc-800/30 bg-zinc-950/80 backdrop-blur-2xl">
      {/* Logo */}
      <div className="p-6">
        <Link href="/feed" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">m</span>
          </div>
          <span className="text-xl font-bold text-zinc-100">
            mesh<span className="text-blue-400">.me</span>
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
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
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
              ? "bg-blue-500/10 text-blue-400"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
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
                ? "bg-blue-500/10 text-blue-400"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
            )}
          >
            <Shield className="h-5 w-5" />
            <span>Admin</span>
          </Link>
        )}

        {/* Create Post Button */}
        <div className="pt-4">
          <Link
            href="/feed?compose=true"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium text-sm hover:from-blue-500 hover:to-blue-400 transition-all duration-200 shadow-lg shadow-blue-500/20 btn-magnetic"
          >
            <PenSquare className="h-4 w-4" />
            <span>Create Post</span>
          </Link>
        </div>
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-zinc-800/30">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{user.displayName}</p>
            <p className="text-xs text-zinc-500 truncate">@{user.username}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <Link
            href="/settings"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 transition-colors"
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
