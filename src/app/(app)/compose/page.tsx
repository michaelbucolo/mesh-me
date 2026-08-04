import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readMyPresence } from "@/lib/mesh/read-my-presence";
import { PLATFORM_RULES } from "@/lib/compose/plan";
import { ComposerView, type ComposerTarget } from "@/components/compose/composer-view";

export const metadata: Metadata = { title: "Post everywhere" };

export default async function ComposePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fcompose");

  // Targets come from the SAME read the mesh draws itself from, so the
  // composer cannot disagree with the mesh about which platforms you have.
  // Two reads of "your connected accounts" would drift, and the drift would
  // show up as a platform you can see on your mesh but cannot post to.
  const presence = await readMyPresence(user.id);
  const connected = new Map(
    presence.arms.filter((a) => a.state !== "offer").map((a) => [a.platform, a.handle]),
  );

  // Every platform we know how to post to is listed, connected or not: a row
  // reading "Not connected" is a nudge, whereas an absent row looks like the
  // composer forgot the platform exists.
  const targets: ComposerTarget[] = PLATFORM_RULES.filter((r) => r.publishable).map((r) => ({
    platform: r.platform,
    handle: connected.get(r.platform) ?? null,
    connected: connected.has(r.platform),
  }));

  return (
    <div className="h-full min-h-full w-full" style={{ background: "#070b14" }}>
      <ComposerView targets={targets} />
    </div>
  );
}
