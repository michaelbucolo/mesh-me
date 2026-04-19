"use client";

import { useEffect, useState } from "react";
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
  Compass,
  Settings,
  Link2,
  Users,
  Rss,
  LayoutDashboard,
  Crown,
  ChevronDown,
  Activity,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/actions";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

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

interface NavItem {
  href: string;
  icon: typeof Waypoints;
  label: string;
  badgeKey?: "messages" | "notifications";
}

interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { href: "/mesh", icon: Waypoints, label: "The Mesh" },
      { href: "/feed", icon: Rss, label: "Feed" },
      { href: "/explore", icon: Compass, label: "Explore" },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/messages", icon: MessageCircle, label: "MeChat", badgeKey: "messages" },
      { href: "/notifications", icon: Bell, label: "Notifications", badgeKey: "notifications" },
      { href: "/communities", icon: Users, label: "Communities" },
    ],
  },
  {
    label: "Manage",
    collapsible: true,
    items: [
      { href: "/content-hub", icon: LayoutDashboard, label: "Content Hub" },
      { href: "/connected-accounts", icon: Link2, label: "Connected Accounts" },
      { href: "/trust", icon: Shield, label: "Trust Center" },
    ],
  },
];

const bottomItems: NavItem[] = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ user, unreadNotifications = 0, unreadMessages = 0 }: SidebarProps) {
  const pathname = usePathname();
  const meshiPrefs = useMeshiPreferences();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [livePulse, setLivePulse] = useState<{ totalOnline: number; sameMeshOnline: number; connectedOnline: number } | null>(null);
  const [pulseHealth, setPulseHealth] = useState<"live" | "degraded">("live");

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const getBadgeCount = (key?: "messages" | "notifications") => {
    if (key === "messages") return unreadMessages;
    if (key === "notifications") return unreadNotifications;
    return 0;
  };

  const isActive = (href: string) => {
    if (href === "/profile") return pathname.includes(`/profile/${user.username}`);
    return pathname.startsWith(href);
  };

  const getHref = (href: string) => {
    if (href === "/profile") return `/profile/${user.username}`;
    return href;
  };

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollPulse = async () => {
      try {
        const res = await fetch("/api/mesh/presence", { cache: "no-store" });
        if (!res.ok) throw new Error("pulse failed");
        const data = await res.json();
        if (!active) return;
        setLivePulse(data.summary || { totalOnline: 0, sameMeshOnline: 0, connectedOnline: 0 });
        setPulseHealth("live");
      } catch {
        if (!active) return;
        setPulseHealth("degraded");
      }
    };

    void pollPulse();
    timer = setInterval(pollPulse, 8000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const badgeCount = getBadgeCount(item.badgeKey);

    return (
      <Link
        key={item.href}
        href={getHref(item.href)}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          active
            ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] shadow-sm"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-[0.98]"
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
    <aside data-sidebar className="hidden h-screen w-[16rem] shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-4 backdrop-blur-2xl lg:flex">
      <Link href="/mesh" className="group mb-5 flex items-center gap-3 px-3 py-1">
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
        <div
          className={cn(
            "ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            pulseHealth === "live" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400",
          )}
          title="Live mesh pulse"
        >
          <Activity className="h-2.5 w-2.5" />
          {livePulse?.totalOnline ?? 0}
        </div>
      </Link>

      <div className="mb-4 grid grid-cols-3 gap-1.5 px-2">
        <div className="rounded-lg bg-[var(--bg-secondary)]/70 px-2 py-1.5">
          <p className="text-[9px] text-[var(--text-muted)] uppercase">Online</p>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{livePulse?.totalOnline ?? 0}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)]/70 px-2 py-1.5">
          <p className="text-[9px] text-[var(--text-muted)] uppercase">Mesh</p>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{livePulse?.sameMeshOnline ?? 0}</p>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)]/70 px-2 py-1.5">
          <p className="text-[9px] text-[var(--text-muted)] uppercase">Network</p>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{livePulse?.connectedOnline ?? 0}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        {navGroups.map((group) => {
          const isCollapsed = group.collapsible && collapsedGroups.has(group.label);
          const groupHasBadge = group.items.some((item) => getBadgeCount(item.badgeKey) > 0);

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
        {bottomItems.map(renderNavItem)}
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

      <div className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-3">
        <div className="flex items-center gap-2.5">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
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
