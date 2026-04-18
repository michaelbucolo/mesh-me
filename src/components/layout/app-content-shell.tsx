"use client";

import { usePathname } from "next/navigation";

export function AppContentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImmersive = pathname === "/mesh";

  if (isImmersive) {
    return <div className="w-full">{children}</div>;
  }

  return <div className="mx-auto w-full max-w-5xl animate-page-enter">{children}</div>;
}
