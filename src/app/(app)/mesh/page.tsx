import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { MeshSceneLoader } from "@/components/mesh/scene/mesh-scene-loader";

export const metadata: Metadata = { title: "Mesh Dashboard" };

export default async function MeshPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = typeof params.user === "string" ? params.user : undefined;
  // Mesh vs Global is URL-driven (?view=global), exactly like ?user=. Global is
  // the guest-viewable world supply and is mutually exclusive with ?user=.
  const viewMode = params.view === "global" ? "global" : "mesh";
  // A self-referential /mesh?user=<me> — reached by tapping your own node in a
  // friend's mesh, or searching yourself — must behave EXACTLY like /mesh.
  // Otherwise the client (which decides "am I on my own mesh?" purely from the
  // absence of this param) renders BOTH your owner Meshi at the heart AND your
  // pointer-following cursor Meshi: two of you. Resolve identity here and drop
  // the param when it points at yourself, so every own-mesh code path is right.
  const user = raw ? await getCurrentUser() : null;
  const isSelf = !!raw && !!user && (raw === user.id || raw.toLowerCase() === user.username.toLowerCase());
  const viewUser = isSelf ? undefined : raw;
  return <MeshSceneLoader viewMode={viewMode} viewUserId={viewMode === "global" ? undefined : viewUser} />;
}
