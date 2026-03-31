"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Waypoints, MessageCircle, Bell, User } from "lucide-react";

interface MobileNavProps {
  unreadNotifications?: number;
  username?: string;
}

// 4 core tabs matching sidebar — Meshi handles everything else
export function MobileNav({ unreadNotifications = 0, username }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/feed", icon: MessageCircle, label: "Feed" },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
    { href: username ? `/profile/${username}` : "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel safe-area-bottom" style={{ borderTop: "1px solid var(--glass-border)", borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
      <div className="flex items-center justify-around px-4 py-1.5">
        {items.map((item) => {
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
