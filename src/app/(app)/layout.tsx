import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMeshiPreference } from "@/lib/actions";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [headerStore, user] = await Promise.all([headers(), getCurrentUser()]);
  const nextPath = getSafeNextPath(headerStore.get("x-mesh-current-path"));

  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }

  if (!user.onboarded) {
    return <OnboardingRedirect />;
  }

  const meshiPref = await getMeshiPreference(user);
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
      <AppShell
        user={{
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isAdmin: user.isAdmin,
          onboarded: user.onboarded,
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
