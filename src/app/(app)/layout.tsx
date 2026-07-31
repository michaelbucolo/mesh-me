import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMeshiPreference } from "@/lib/actions";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { AutoSyncBeacon } from "@/components/auto-sync-beacon";
import { NativeInit } from "@/components/native-init";
import { MeshiPrefsBootstrap } from "@/components/meshi/meshi-prefs-bootstrap";
import { OnboardingRedirect } from "@/components/onboarding-redirect";

export const metadata: Metadata = {
  title: {
    template: "%s | mesh.me",
    default: "mesh.me",
  },
};

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const parsed = new URL(value, "https://mesh.me");
    if (parsed.origin !== "https://mesh.me") return null;
    if (parsed.pathname === "/login" || parsed.pathname === "/signup" || parsed.pathname === "/reset-password") {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

// Surfaces guests may browse without an account. Watching and reading are
// open; anything that ACTS (like, follow, comment, post) asks to sign in.
function isGuestViewablePath(path: string): boolean {
  if (path === "/flow" || path.startsWith("/flow/") || path.startsWith("/flow?")) return true;
  if (path === "/explore" || path.startsWith("/explore/") || path.startsWith("/explore?")) return true;
  // Post details only — the personal home feed stays yours alone.
  if (path.startsWith("/feed/")) return true;
  return false;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // One parallel round: getMeshiPreference resolves the (request-cached) user
  // internally, so starting it alongside saves a serial DB stage on EVERY
  // authenticated page.
  const [headerStore, user, meshiPref] = await Promise.all([headers(), getCurrentUser(), getMeshiPreference()]);
  const nextPath = getSafeNextPath(headerStore.get("x-mesh-current-path"));

  if (!user) {
    if (nextPath && isGuestViewablePath(nextPath)) {
      return (
        <ToastProvider>
          <NativeInit />
          <div className="flex h-dvh min-h-0 flex-col bg-[#05070f]">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur">
              <Link href="/" className="text-sm font-semibold tracking-tight text-white">
                mesh.me
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/login?next=${encodeURIComponent(nextPath)}`}
                  className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Create account
                </Link>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          </div>
        </ToastProvider>
      );
    }
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }

  if (!user.onboarded) {
    return <OnboardingRedirect />;
  }

  const meshiSeed = meshiPref
    ? {
        colorTheme: meshiPref.colorTheme,
        hatStyle: meshiPref.hatStyle,
        faceStyle: meshiPref.faceStyle,
        hairStyle: meshiPref.hairStyle,
        accessoryStyle: meshiPref.accessoryStyle,
        eyeStyle: meshiPref.eyeStyle,
        badgeStyle: meshiPref.badgeStyle,
        outfitStyle: meshiPref.outfitStyle,
      }
    : null;

  return (
    <ToastProvider>
      <MeshiPrefsBootstrap serverPref={meshiSeed} />
      <NativeInit />
      {/* Signed-in only: keeps connected accounts fresh without a manual
          Sync click. Guests have nothing to sync. */}
      <AutoSyncBeacon />
      <AppShell
        user={{
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isAdmin: user.isAdmin,
          onboarded: user.onboarded,
          ghostMode: user.ghostMode,
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
