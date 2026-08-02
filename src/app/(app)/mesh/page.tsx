import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { hasMeshPro } from "@/lib/mesh-pro";
import { readWantsYou } from "@/lib/mesh/read-wants-you";
import { MeshField } from "@/components/meshfield/mesh-field";
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
  const user = await getCurrentUser();
  const isSelf = !!raw && !!user && (raw === user.id || raw.toLowerCase() === user.username.toLowerCase());
  const viewUser = isSelf ? undefined : raw;

  // ── YOUR OWN MESH IS THE NEW FIELD ────────────────────────────────────────
  //
  // Signed in, no ?user=, not global: this is the home dashboard, and it is the
  // ring field. The read happens HERE rather than behind an endpoint because
  // this is already a server component — one round trip instead of two, and
  // nothing fires after the bundle downloads.
  //
  // `nowMs` is resolved once, on the server, and handed to the client. That is
  // deliberate: the field's placement is a pure function of (items, nowMs), so
  // a single server-decided clock makes the server and client renders agree
  // exactly. Calling Date.now() in the component would reintroduce the
  // hydration mismatch the pure layer exists to avoid.
  //
  // The other two shapes still belong to the old scene, and are NOT swapped:
  //
  //   ?user=<someone>  — someone else's mesh. "What wants you" is a read of
  //                      YOUR obligations; it has no meaning pointed at a
  //                      stranger, so this is not the same surface with a
  //                      different id. Still linked from a profile.
  //   ?view=global     — the opt-in world mesh. A different supply entirely.
  //
  // Both keep working until they get a considered answer of their own. Deleting
  // the old tree before then would delete two live features to make one file
  // tidier.
  if (user && !viewUser && viewMode === "mesh") {
    const { items, nowMs } = await readWantsYou(user.id);
    return (
      <div className="h-full w-full">
        <MeshField items={items} nowMs={nowMs} roomUserId={user.id} viewerId={user.id} />
      </div>
    );
  }

  return (
    <MeshSceneLoader
      viewMode={viewMode}
      viewUserId={viewMode === "global" ? undefined : viewUser}
      // Server-decided, never inferred on the client: hasMeshPro covers a
      // founder's derived membership as well as a paid subscription.
      viewerIsPro={hasMeshPro(user)}
    />
  );
}
