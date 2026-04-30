import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsControlCenter } from "@/components/settings/settings-control-center";
import { getCurrentUser } from "@/lib/auth";
import { getMeshCosmetics, getMeshiPreference } from "@/lib/actions";
import { getMeshPrivacy, getPrivacyTransparencyData, getUserSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Settings",
  description: "Mesh.me account, privacy, security, data, and Meshi settings.",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  if (!user.onboarded) redirect("/onboarding");

  const [settings, meshPrivacy, meshiPreference, meshCosmetics, privacyData] = await Promise.all([
    getUserSettings(),
    getMeshPrivacy(),
    getMeshiPreference(),
    getMeshCosmetics(),
    getPrivacyTransparencyData(),
  ]);

  if (!settings) redirect("/login?next=/settings");

  return (
    <SettingsControlCenter
      settings={{
        email: settings.email,
        emailVerified: settings.emailVerified,
        username: settings.username,
        displayName: settings.displayName,
        bio: settings.bio,
        location: settings.location,
        website: settings.website,
        accentColor: settings.accentColor,
        isPublic: settings.isPublic,
        showInDiscovery: settings.showInDiscovery,
        hideActivityStatus: settings.hideActivityStatus,
        readReceipts: settings.readReceipts,
        nsfwEnabled: settings.nsfwEnabled,
        adultVerificationStatus: settings.adultVerificationStatus,
        adultVerifiedAt: settings.adultVerifiedAt,
        adultVerificationExpiresAt: settings.adultVerificationExpiresAt,
        adultVerificationProvider: settings.adultVerificationProvider,
        adultVerificationRegion: settings.adultVerificationRegion,
        isMeshPro: settings.isMeshPro,
        interests: settings.interests,
        connectedAccounts: settings.connectedAccounts,
        links: settings.links,
        notificationPreference: settings.notificationPreference,
      }}
      meshPrivacy={{
        meshVisibility: meshPrivacy?.meshVisibility ?? "friends",
        branchOverrides: meshPrivacy?.branchOverrides ?? "{}",
        showConnections: meshPrivacy?.showConnections ?? true,
        showStats: meshPrivacy?.showStats ?? false,
      }}
      meshi={{
        hatStyle: meshiPreference?.hatStyle ?? "none",
        faceStyle: meshiPreference?.faceStyle ?? "happy",
        colorTheme: meshiPreference?.colorTheme ?? "blue",
        hairStyle: meshiPreference?.hairStyle ?? "none",
        accessoryStyle: meshiPreference?.accessoryStyle ?? "none",
        eyeStyle: meshiPreference?.eyeStyle ?? "regular",
        badgeStyle: meshiPreference?.badgeStyle ?? "none",
        outfitStyle: meshiPreference?.outfitStyle ?? "none",
      }}
      meshCosmetics={meshCosmetics.map((cosmetic) => ({
        type: cosmetic.type,
        value: cosmetic.value,
        isActive: cosmetic.isActive,
      }))}
      privacySummary={{
        sessions: privacyData?.sessions ?? 0,
        dataStored: privacyData?.dataStored ?? {},
        connections: privacyData?.connections ?? { followers: 0, following: 0, communities: 0 },
      }}
    />
  );
}
