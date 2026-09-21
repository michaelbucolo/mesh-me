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
    <main className="public-offline">
      <div className="offline-orbit" aria-hidden="true"><span className="offline-meshi"><i /><i /></span><span className="offline-satellite" /></div>
      <p className="public-kicker">mesh.me</p>
      <h1>A quiet moment.</h1>
      <p className="offline-copy">You&apos;re offline. Reconnect and pick up right where you left off.</p>
      <Link href="/mesh" className="public-join-link">Try again <span aria-hidden="true">↗</span></Link>
      <p className="offline-caption">Your world is worth coming back to.</p>
    </main>
  );
}

// Prerendered HTML freezes build-time markup while the proxy stamps a fresh CSP
// nonce per request — every script on the cached page was refused (~25 console
// errors, zero hydration; journey audit). Per-request rendering lets Next stamp
// the live nonce onto its scripts, the same way every dynamic page already works.
export const dynamic = "force-dynamic";
