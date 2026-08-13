import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MeshiJournalPanel } from "@/components/privacy/meshi-journal-panel";
import { PrivacyControlCenter } from "@/components/privacy/privacy-control-center";
import { getCurrentUser } from "@/lib/auth";
import { getPrivacyControlCenter } from "@/lib/privacy-control-center";

export const metadata: Metadata = {
  title: "Privacy Controls",
  description: "Review connected data, syncing, visibility, exports, and permanent account deletion on Mesh.me.",
};

export default async function PrivacyControlsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/privacy-controls");
  if (!user.onboarded) redirect("/onboarding");

  const data = await getPrivacyControlCenter();
  if (!data) redirect("/login?next=/privacy-controls");

  return (
    <>
      <PrivacyControlCenter data={data} />
      {/* Beside the Meshi memory READ rule above: what Meshi may KEEP. Two
          different promises, each with its own honest switch. */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
        <MeshiJournalPanel />
      </div>
    </>
  );
}
