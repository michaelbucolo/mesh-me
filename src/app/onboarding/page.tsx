import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getCurrentUser } from "@/lib/auth";
import { getMeshiPreference } from "@/lib/actions";
import { getSupportedPlatformAdapter } from "@/lib/platform-adapters";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Set up Mesh.me",
  description: "Create your Mesh.me profile, Meshi, privacy defaults, notifications, interface style, and first connected account.",
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  if (user.onboarded) redirect("/mesh");

  const [meshi, meshPrivacy, feedPreference, notificationPreference, connectedAccounts] = await Promise.all([
    getMeshiPreference(),
    prisma.meshPrivacy.findUnique({ where: { userId: user.id } }),
    prisma.feedPreference.findUnique({ where: { userId: user.id } }),
    prisma.userNotificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id },
      select: { platform: true, isActive: true },
    }),
  ]);

  // Popular apps people commonly use, ordered roughly by reach. OAuth-capable
  // platforms can be quick-merged right after setup; manual ones are tracked too.
  const popularApps = [
    "instagram", "tiktok", "youtube", "twitter", "threads", "facebook",
    "snapchat", "discord", "twitch", "reddit", "linkedin", "pinterest",
  ];
  const platformOptions = popularApps
    .map((platform) => {
      const adapter = getSupportedPlatformAdapter(platform);
      if (!adapter) return null;
      return {
        id: adapter.id,
        name: adapter.name,
        authType: adapter.authType,
        connected: connectedAccounts.some((account) => account.platform === platform && account.isActive),
      };
    })
    .filter((option): option is { id: string; name: string; authType: "oauth" | "manual"; connected: boolean } => Boolean(option));

  return (
    <OnboardingFlow
      user={{
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio ?? "",
        location: user.location ?? "",
      }}
      meshi={{
        colorTheme: meshi?.colorTheme ?? "blue",
        hatStyle: meshi?.hatStyle ?? "none",
        faceStyle: meshi?.faceStyle ?? "happy",
        hairStyle: meshi?.hairStyle ?? "none",
        accessoryStyle: meshi?.accessoryStyle ?? "none",
        eyeStyle: meshi?.eyeStyle ?? "regular",
        badgeStyle: meshi?.badgeStyle ?? "none",
      }}
      meshPrivacy={{
        meshVisibility: meshPrivacy?.meshVisibility ?? "private",
        showConnections: meshPrivacy?.showConnections ?? false,
        showStats: meshPrivacy?.showStats ?? false,
      }}
      feedPreference={{
        layout: feedPreference?.layout ?? "balanced",
      }}
      notificationPreference={{
        pushEnabled: notificationPreference?.pushEnabled ?? true,
        emailDigest: notificationPreference?.emailDigest ?? "weekly",
        messages: notificationPreference?.messages ?? true,
        mentions: notificationPreference?.mentions ?? true,
        comments: notificationPreference?.comments ?? true,
        follows: notificationPreference?.follows ?? true,
        platformAlerts: notificationPreference?.platformAlerts ?? true,
        productUpdates: notificationPreference?.productUpdates ?? false,
      }}
      platformOptions={platformOptions}
    />
  );
}
