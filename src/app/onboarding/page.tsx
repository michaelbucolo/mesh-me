import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getCurrentUser } from "@/lib/auth";
import { getMeshiPreference } from "@/lib/actions";
import { OAUTH_CONFIGS } from "@/lib/oauth";
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

  const platformOptions = ["youtube", "instagram", "twitter", "threads", "facebook", "discord", "tiktok", "twitch", "reddit", "snapchat"]
    .filter((platform) => OAUTH_CONFIGS[platform])
    .map((platform) => ({
      id: platform,
      name: OAUTH_CONFIGS[platform].name,
      connected: connectedAccounts.some((account) => account.platform === platform && account.isActive),
    }));

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
        outfitStyle: meshi?.outfitStyle ?? "none",
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
