"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const routeDescriptions: Record<string, { label: string; blurb: string }> = {
  "/feed": { label: "Feed", blurb: "Curated stories, signals, and updates from your network." },
  "/explore": { label: "Explore", blurb: "Find new creators, communities, and opportunities." },
  "/messages": { label: "MeChat", blurb: "Fast, focused conversations with your people." },
  "/notifications": { label: "Notifications", blurb: "Important alerts and activity highlights." },
  "/communities": { label: "Communities", blurb: "Places where your audience and collaborators gather." },
  "/settings": { label: "Settings", blurb: "Personalize mesh.me exactly how you like it." },
};

export function AppContentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersive = pathname === "/mesh";

  const routeInfo = useMemo(() => {
    const firstSegment = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return routeDescriptions[pathname] ?? routeDescriptions[firstSegment] ?? null;
  }, [pathname]);

  const crumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 1) return null;

    return segments.map((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join("/")}`;
      return {
        href,
        label: segment.replace(/-/g, " "),
      };
    });
  }, [pathname]);

  if (isImmersive) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl animate-page-enter">
      {routeInfo && (
        <section className="premium-surface mb-5 rounded-3xl p-5">
          {crumbs && (
            <nav className="mb-2 flex flex-wrap items-center gap-1 text-[11px] capitalize text-[var(--text-muted)]">
              <Link href="/mesh" className="hover:text-[var(--text-secondary)]">mesh</Link>
              {crumbs.map((crumb) => (
                <span key={crumb.href} className="inline-flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <Link href={crumb.href} className="hover:text-[var(--text-secondary)]">{crumb.label}</Link>
                </span>
              ))}
            </nav>
          )}
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{routeInfo.label}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{routeInfo.blurb}</p>
        </section>
      )}

      {children}
    </div>
  );
}
