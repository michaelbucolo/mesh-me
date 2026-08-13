import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiTokensPanel, type TokenRow } from "@/components/privacy/api-tokens-panel";
import { MeshiJournalPanel } from "@/components/privacy/meshi-journal-panel";
import { PrivacyControlCenter } from "@/components/privacy/privacy-control-center";
import { getCurrentUser } from "@/lib/auth";
import { listPersonalAccessTokens } from "@/lib/personal-access-token";
import { getPrivacyControlCenter } from "@/lib/privacy-control-center";

export const metadata: Metadata = {
  title: "Privacy Controls",
  description: "Review connected data, syncing, visibility, exports, and permanent account deletion on Mesh.me.",
};

// Fingerprints and facts only, never anything recoverable; "expired" is
// computed here so the client component never consults a clock.
function toTokenRows(
  rows: Array<{ id: string; name: string; selector: string; scopes: string; createdAt: Date; expiresAt: Date; lastUsedAt: Date | null }>,
): TokenRow[] {
  const now = Date.now();
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    selector: t.selector,
    scopes: t.scopes,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    expired: t.expiresAt.getTime() <= now,
  }));
}

export default async function PrivacyControlsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/privacy-controls");
  if (!user.onboarded) redirect("/onboarding");

  const data = await getPrivacyControlCenter();
  if (!data) redirect("/login?next=/privacy-controls");

  // Server-provided so the panel needs no mount fetch.
  const tokenRows = toTokenRows(await listPersonalAccessTokens(user.id));

  return (
    <>
      <PrivacyControlCenter data={data} />
      {/* Beside the Meshi memory READ rule above: what Meshi may KEEP. Two
          different promises, each with its own honest switch. */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-4 sm:px-6">
        <MeshiJournalPanel />
      </div>
      {/* And beside the export controls: the export surface made
          programmatic. A standing grant instrument lives with the other
          standing grants, not in a settings drawer. */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
        <ApiTokensPanel initialTokens={tokenRows} />
      </div>
    </>
  );
}
