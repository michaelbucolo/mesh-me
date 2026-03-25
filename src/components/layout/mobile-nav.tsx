"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Compass, PenSquare, Bell, User, Waypoints, MessageCircle } from "lucide-react";

interface MobileNavProps {
  username: string;
  unreadNotifications?: number;
}

export function MobileNav({ username, unreadNotifications = 0 }: MobileNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/feed", icon: Home, label: "Home" },
    { href: "/mesh", icon: Waypoints, label: "Mesh" },
    { href: "/feed?compose=true", icon: PenSquare, label: "Post", isAction: true },
    { href: "/messages", icon: MessageCircle, label: "MeChat" },
    { href: "/notifications", icon: Bell, label: "Alerts", badge: unreadNotifications },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive = item.href === "/feed"
            ? pathname === "/feed"
            : pathname.startsWith(item.href.split("?")[0]);

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center p-2 -mt-4"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
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
                "flex flex-col items-center justify-center p-2 min-w-[60px] relative",
                isActive ? "text-indigo-400" : "text-zinc-500"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] mt-1">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute top-1 right-2 bg-indigo-600 text-white text-[9px] rounded-full h-4 min-w-4 flex items-center justify-center px-1">
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
