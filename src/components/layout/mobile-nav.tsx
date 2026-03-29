"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, PenSquare, Bell, Waypoints, MessageCircle } from "lucide-react";

interface MobileNavProps {
  unreadNotifications?: number;
}

export function MobileNav({ unreadNotifications = 0 }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/feed", icon: Home, label: "Feed" },
    { href: "/feed?compose=true", icon: PenSquare, label: "Post", isAction: true },
    { href: "/messages", icon: MessageCircle, label: "MeChat" },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel safe-area-bottom" style={{ borderTop: "1px solid var(--glass-border)", borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive = item.href === "/feed"
            ? pathname === "/feed"
            : item.href === "/mesh"
            ? pathname === "/mesh"
            : pathname.startsWith(item.href.split("?")[0]);

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center p-2 -mt-4"
              >
                <div className="brand-button h-12 w-12 rounded-full flex items-center justify-center shadow-lg">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 min-w-[60px] relative transition-all duration-200 active:scale-90",
                isActive ? "" : ""
              )}
            >
              <item.icon className="h-5 w-5" style={isActive ? { color: "var(--accent)" } : { color: "var(--text-muted)" }} />
              <span className="text-[10px] mt-1" style={isActive ? { color: "var(--accent)" } : { color: "var(--text-muted)" }}>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute top-1 right-2 text-white text-[9px] rounded-full h-4 min-w-4 flex items-center justify-center px-1" style={{ background: "var(--accent)" }}>
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
