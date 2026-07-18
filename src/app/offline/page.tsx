import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
  description: "mesh.me is waiting for a connection.",
};

// The service worker serves this page when a navigation happens with no
// network. Static, tiny, and dependency-free so it always renders.
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#05070f] px-6 text-center">
      <span className="text-2xl font-extrabold tracking-tight text-white">mesh.me</span>
      <p className="max-w-xs text-sm leading-6 text-white/60">
        You&apos;re offline. Your mesh is still out there — reconnect and pick up right
        where you left off.
      </p>
      <Link
        href="/mesh"
        className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        Try again
      </Link>
    </main>
  );
}
