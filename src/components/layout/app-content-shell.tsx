"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const routeDescriptions: Record<string, { label: string }> = {
  "/feed": { label: "Feed" },
  "/explore": { label: "Explore" },
  "/messages": { label: "MeChat" },
  "/notifications": { label: "Notifications" },
  "/communities": { label: "Communities" },
  "/settings": { label: "Settings" },
};

export function AppContentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersive = pathname === "/mesh";

  const routeInfo = useMemo(() => {
    const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return routeDescriptions[pathname] ?? routeDescriptions[firstSegment] ?? null;
  }, [pathname]);

  if (isImmersive) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl animate-page-enter">
      {routeInfo && (
        <section className="mb-3 border-b border-[var(--border-primary)] pb-2 lg:hidden">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{routeInfo.label}</h2>
        </section>
      )}

      {routeInfo && (
        <section className={cn("mb-4 hidden items-center justify-between border-b border-[var(--border-primary)] pb-3 lg:flex")}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{routeInfo.label}</h2>
          <Link href="/mesh" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">mesh</Link>
        </section>
      )}

      {children}
    </div>
  );
}
