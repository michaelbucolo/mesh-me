"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { impactFeedback } from "@/lib/native/haptics";
import { getBadgeCount, isNavItemActive, mobileNavItems, resolveNavHref } from "@/components/layout/navigation-config";

interface MobileNavProps {
  unreadNotifications?: number;
  unreadMessages?: number;
  username?: string;
}

export function MobileNav({ unreadNotifications = 0, unreadMessages = 0, username }: MobileNavProps) {
  const pathname = usePathname();


  return (
    <nav className="safe-area-bottom fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1 shadow-[var(--shadow-lg)] backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-6">
        {mobileNavItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href, username);
          const badgeCount = getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages);

          return (
            <Link
              key={item.href}
              href={resolveNavHref(item.href, username)}
              onClick={() => impactFeedback("LIGHT")}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[9px] font-medium transition-all duration-200 active:scale-90",
                isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-tertiary)]"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive && "drop-shadow-[0_0_6px_var(--accent)]")} />
              <span className="mt-0.5">{item.label}</span>
              {badgeCount > 0 && (
                <span className="absolute right-1.5 top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
              {isActive && (
                <span className="absolute -bottom-0.5 h-0.5 w-4 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
