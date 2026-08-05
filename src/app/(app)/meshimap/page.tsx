import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { readMap } from "@/lib/meshimap/read-map";
import { MeshiMap } from "@/components/meshimap/meshi-map";

export const metadata: Metadata = { title: "MeshiMap" };

// MESHIMAP — see who is around you, and walk into their mesh.
//
// The read is a server component so the pins arrive with the HTML: a map that
// paints empty and then pops people in reads as broken, and doing it here also
// means the browser never holds a fetch that returns other people's locations.
//
// Signed out, there is no map at all. "Everyone" means everyone on mesh.me,
// not everyone on the internet, and a public page of real people's locations
// is a scraping target with a UI on it.

export default async function MeshiMapPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell>
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 style={{ color: "#e8edf8", fontSize: 20, fontWeight: 600 }}>MeshiMap</h1>
          <p style={{ color: "#93a0bb", fontSize: 14, maxWidth: 380 }}>
            See who is around you and step straight into their mesh. Everyone shows at their
            area — never their address — and only to the people they chose.
          </p>
          <Link
            href="/signup"
            className="mt-1 rounded-full px-4 py-2"
            style={{ background: "#60a5fa", color: "#04060c", fontSize: 14, fontWeight: 600 }}
          >
            Join the mesh
          </Link>
        </div>
      </Shell>
    );
  }

  const { pins, you, nowMs, doodles } = await readMap(user.id);

  return (
    <Shell>
      <MeshiMap pins={pins} you={you} nowMs={nowMs} doodles={doodles} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-full w-full">{children}</div>;
}
