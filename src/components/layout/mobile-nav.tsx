"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Waypoints, Compass, MessageCircle, Crown, Bell, User } from "lucide-react";

interface MobileNavProps {
  unreadNotifications?: number;
  username?: string;
}

export function MobileNav({ unreadNotifications = 0, username }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/explore", icon: Compass, label: "Explore" },
    { href: "/feed", icon: Home, label: "Feed" },
    { href: "/messages", icon: MessageCircle, label: "Messages", badge: unreadNotifications },
    { href: username ? `/profile/${username}` : "/profile", icon: User, label: "Profile" },
    { href: "/meshpro", icon: Crown, label: "MeshPro" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel safe-area-bottom" style={{ borderTop: "1px solid var(--glass-border)", borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
      {/* Notification bell - top right of mobile nav */}
      <Link
        href="/notifications"
        className="absolute -top-10 right-3 p-2.5 rounded-full glass-surface shadow-lg"
      >
        <Bell className="h-4 w-4" style={{ color: pathname.startsWith("/notifications") ? "var(--accent)" : "var(--text-muted)" }} />
        {unreadNotifications > 0 && (
          <span className="absolute -top-1 -right-1 text-white text-[8px] font-bold rounded-full h-3.5 min-w-3.5 flex items-center justify-center px-0.5" style={{ background: "#ef4444" }}>
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </Link>
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive = item.href === "/feed"
            ? pathname === "/feed" || pathname.startsWith("/feed")
            : item.label === "Profile"
              ? pathname.includes("/profile/")
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 min-w-[48px] relative transition-all duration-200 active:scale-90",
                isActive ? "" : ""
              )}
            >
              <item.icon className="h-5 w-5" style={isActive ? { color: "var(--accent)" } : { color: "var(--text-muted)" }} />
              <span className="text-[9px] mt-0.5" style={isActive ? { color: "var(--accent)" } : { color: "var(--text-muted)" }}>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute top-1 right-0 text-white text-[8px] rounded-full h-3.5 min-w-3.5 flex items-center justify-center px-0.5" style={{ background: "var(--accent)" }}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
