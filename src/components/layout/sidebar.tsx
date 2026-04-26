"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut, Shield, Crown, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { desktopBottomItems, desktopNavGroups, getBadgeCount, isNavItemActive, resolveNavHref, type NavItem } from "@/components/layout/navigation-config";

interface SidebarProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  unreadNotifications?: number;
  unreadMessages?: number;
}


export function Sidebar({ user, unreadNotifications = 0, unreadMessages = 0 }: SidebarProps) {
  const pathname = usePathname();
  const meshiPrefs = useMeshiPreferences();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const renderNavItem = (item: NavItem) => {
    const active = isNavItemActive(pathname, item.href, user.username);
    const badgeCount = getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages);

    return (
      <Link
        key={item.href}
        href={resolveNavHref(item.href, user.username)}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150",
          active
            ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        )}
      >
        <item.icon className={cn("h-[17px] w-[17px] shrink-0", active && "text-[var(--accent)]")} />
        <span className="truncate">{item.label}</span>
        {badgeCount > 0 && (
          <span className="notif-dot ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside data-sidebar className="hidden h-screen w-[15rem] shrink-0 flex-col border-r border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-3 lg:flex">
      <Link href="/mesh" className="group mb-4 flex items-center gap-3 px-3 py-1">
        <MeshiMascot
          size={30}
          color={meshiPrefs.appLogo === "custom" ? meshiPrefs.appLogoColor : "blue"}
          mood={meshiPrefs.appLogo === "custom" ? meshiPrefs.face : "happy"}
          hat={meshiPrefs.appLogo === "custom" ? meshiPrefs.hat : "none"}
          animate
          showGlow={false}
          bouncy
        />
        <p className="brand-wordmark text-lg text-[var(--text-primary)]">
          mesh<span className="brand-wordmark-accent">.me</span>
        </p>
      </Link>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        {desktopNavGroups.map((group) => {
          const isCollapsed = group.collapsible && collapsedGroups.has(group.label);
          const groupHasBadge = group.items.some((item) => getBadgeCount(item.badgeKey, unreadNotifications, unreadMessages) > 0);

          return (
            <div key={group.label}>
              {group.collapsible ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="mb-1 flex w-full items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {group.label}
                    {isCollapsed && groupHasBadge && (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    )}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
                </button>
              ) : (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.label}
                </p>
              )}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map(renderNavItem)}
                </div>
              )}
            </div>
          );
        })}

        {user.isAdmin && (
          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Admin
            </p>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition",
                pathname.startsWith("/admin")
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Shield className="h-[17px] w-[17px]" />
              <span>Admin Console</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="mb-3 space-y-0.5">
        {desktopBottomItems.map(renderNavItem)}
        <Link
          href="/meshpro"
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
            pathname.startsWith("/meshpro")
              ? "bg-amber-500/10 text-amber-400"
              : "text-[var(--text-muted)] hover:bg-amber-500/5 hover:text-amber-400"
          )}
        >
          <Crown className={cn("h-[17px] w-[17px] shrink-0", pathname.startsWith("/meshpro") ? "text-amber-400" : "text-amber-500/60")} />
          <span className="truncate">MeshPro</span>
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
            <span className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--bg-primary)] bg-[var(--bg-elevated)]">
              <MeshiMascot
                size={10}
                color={meshiPrefs.color}
                hat={meshiPrefs.hat}
                mood={meshiPrefs.face}
                showGlow={false}
                animate={false}
              />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{user.displayName}</p>
            <p className="truncate text-[10px] text-[var(--text-muted)]">@{user.username}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
