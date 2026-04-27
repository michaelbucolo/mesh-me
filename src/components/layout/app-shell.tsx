"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppChrome } from "@/components/layout/app-chrome";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  needsEmailVerification: boolean;
  needsPhoneVerification: boolean;
  userEmail: string;
  initialCounts: UnreadCounts;
}

interface UnreadCounts {
  unreadNotifications: number;
  unreadMessages: number;
}

export function AppShell({
  children,
  user,
  needsEmailVerification,
  needsPhoneVerification,
  userEmail,
  initialCounts,
}: AppShellProps) {
  const [counts, setCounts] = useState<UnreadCounts>(initialCounts);

  useEffect(() => {
    let mounted = true;
    let inFlightController: AbortController | null = null;

    const loadCounts = async () => {
      if (document.visibilityState !== "visible") return;

      inFlightController?.abort();
      const controller = new AbortController();
      inFlightController = controller;

      try {
        const response = await fetch("/api/layout/unread-counts", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as Partial<UnreadCounts>;
        if (!mounted) return;
        setCounts({
          unreadNotifications: Number(data.unreadNotifications ?? 0),
          unreadMessages: Number(data.unreadMessages ?? 0),
        });
      } catch {
        // Keep default counts if request fails.
      }
    };

    void loadCounts();
    const interval = window.setInterval(() => void loadCounts(), 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadCounts();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      inFlightController?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      <div className="relative z-10 flex h-full">
        <Sidebar user={user} unreadNotifications={counts.unreadNotifications} unreadMessages={counts.unreadMessages} />

        <div className="flex h-full min-w-0 flex-1 flex-col">
          <AppChrome
            unreadNotifications={counts.unreadNotifications}
            unreadMessages={counts.unreadMessages}
            username={user.username}
            needsEmailVerification={needsEmailVerification}
            needsPhoneVerification={needsPhoneVerification}
            userEmail={userEmail}
          >
            {children}
          </AppChrome>
        </div>
      </div>

      <MobileNav unreadNotifications={counts.unreadNotifications} unreadMessages={counts.unreadMessages} username={user.username} />
    </>
  );
}
