"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

type WhatsNewDrawerProps = {
  userId: string;
};

const currentUpdate = {
  id: "2026-04-30-public-status-and-recovery",
  title: "What changed in Mesh.me",
  eyebrow: "New since your last visit",
  summary: "Mesh.me has cleaner recovery screens, a public status page, and easier safety visibility across the app.",
  items: [
    "Added the public System Status page for website, database, messaging, integrations, uploads, and payments.",
    "Rebuilt broken-link and server-error screens with Meshi-led recovery states.",
    "Made account recovery routes clearer with fast links back to Home, Search, Support, and the Mesh.",
  ],
  primaryLink: { href: "/status", label: "View status" },
} as const;

function getStorageKey(userId: string) {
  return `mesh.whats-new.seen.${userId}`;
}

export function WhatsNewDrawer({ userId }: WhatsNewDrawerProps) {
  const [open, setOpen] = useState(false);
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, currentUpdate.id);
    } catch {
      // The drawer should still close if storage is blocked.
    }
  }, [storageKey]);

  const dismiss = useCallback(() => {
    markSeen();
    setOpen(false);
  }, [markSeen]);

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      try {
        const seenUpdateId = window.localStorage.getItem(storageKey);
        if (seenUpdateId !== currentUpdate.id) setOpen(true);
      } catch {
        setOpen(true);
      }
    }, 900);

    return () => window.clearTimeout(showTimer);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, open]);

  if (!open) return null;

  return (
    <aside className="whats-new-drawer" role="dialog" aria-modal="false" aria-labelledby="whats-new-title" aria-describedby="whats-new-summary">
      <div className="whats-new-drawer-glow" aria-hidden="true" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="whats-new-meshi">
            <MeshiLogo size={38} color="blue" mood="happy" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{currentUpdate.eyebrow}</p>
            <h2 id="whats-new-title" className="mt-1 text-base font-black text-[var(--text-primary)]">
              {currentUpdate.title}
            </h2>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="whats-new-close" aria-label="Close what's new">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p id="whats-new-summary" className="relative z-10 mt-4 text-sm leading-6 text-[var(--text-secondary)]">
        {currentUpdate.summary}
      </p>

      <div className="relative z-10 mt-4 grid gap-2">
        {currentUpdate.items.map((item) => (
          <div key={item} className="flex gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/74 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <p className="text-sm leading-5 text-[var(--text-secondary)]">{item}</p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Link href={currentUpdate.primaryLink.href} onClick={dismiss} className="mesh-action mesh-action-primary justify-center px-4 text-sm">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {currentUpdate.primaryLink.label}
        </Link>
        <button type="button" onClick={dismiss} className="mesh-choice inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-[var(--text-secondary)]">
          Got it
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
