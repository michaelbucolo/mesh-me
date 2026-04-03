"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Waypoints, MessageCircle, Bell, User, Home, Search } from "lucide-react";

interface MobileNavProps {
  unreadNotifications?: number;
  username?: string;
  onOpenMeshi?: () => void;
}

export function MobileNav({ unreadNotifications = 0, username, onOpenMeshi }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/feed", icon: MessageCircle, label: "Feed" },
    { href: "meshi", icon: Search, label: "Meshi", isMeshi: true },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
    { href: username ? `/profile/${username}` : "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel safe-area-bottom" style={{ borderTop: "1px solid var(--glass-border)", borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
      <div className="flex items-center justify-around px-4 py-1.5">
        {items.map((item) => {
          if ("isMeshi" in item && item.isMeshi) {
            return (
              <button
                key="meshi"
                onClick={onOpenMeshi}
                className="flex flex-col items-center justify-center p-2 min-w-[56px] relative transition-all duration-200 active:scale-90"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
                  <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                </div>
                <span className="text-[9px] mt-0.5 font-medium" style={{ color: "var(--accent)" }}>{item.label}</span>
              </button>
            );
          }

          const isActive = item.href === "/feed"
            ? pathname === "/feed" || pathname.startsWith("/feed")
            : item.label === "Profile"
              ? pathname.includes(`/profile/${username}`)
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 min-w-[56px] relative transition-all duration-200 active:scale-90"
              )}
            >
              <item.icon className="h-5 w-5" style={isActive ? { color: "var(--accent)" } : { color: "var(--text-muted)" }} />
              <span className="text-[9px] mt-0.5 font-medium" style={isActive ? { color: "var(--accent)" } : { color: "var(--text-muted)" }}>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute top-0.5 right-1 text-white text-[8px] font-bold rounded-full h-3.5 min-w-3.5 flex items-center justify-center px-0.5" style={{ background: "#ef4444" }}>
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
