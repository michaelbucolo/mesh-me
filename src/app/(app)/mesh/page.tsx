import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readGlobalMesh } from "@/lib/mesh/read-global-mesh";
import { readTheirMesh } from "@/lib/mesh/read-their-mesh";
import { readWantsYou } from "@/lib/mesh/read-wants-you";
import { MeshField } from "@/components/meshfield/mesh-field";

export const metadata: Metadata = { title: "Mesh Dashboard" };

// ── ONE SURFACE, THREE QUESTIONS ────────────────────────────────────────────
//
// Every shape of /mesh is now the ring field. What changes between them is the
// READ and what the centre says — never the renderer, which is why the old
// 66-file canvas tree could go.
//
//   /mesh                what wants YOU        readWantsYou
//   /mesh?user=<who>     what THEY put out     readTheirMesh
//   /mesh?view=global    who has opted in      readGlobalMesh
//
// All three reads happen here rather than behind an endpoint: this is already
// a server component, so it is one round trip instead of two, with nothing
// firing after the bundle downloads. Each read stamps its own `nowMs` and
// hands it back, so the server and client agree on the instant the layout was
// computed from — the field's placement is pure in (items, nowMs), and that
// guarantee only holds if both sides get the same clock.

export default async function MeshPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = typeof params.user === "string" ? params.user : undefined;
  // Mesh vs Global is URL-driven (?view=global), exactly like ?user=. Global is
  // the guest-viewable world supply and is mutually exclusive with ?user=.
  const viewMode = params.view === "global" ? "global" : "mesh";
  const user = await getCurrentUser();
  // A self-referential /mesh?user=<me> — reached by tapping your own node, or
  // by searching yourself — must behave EXACTLY like /mesh, or you would be
  // reading your own mesh as though you were a stranger to it.
  const isSelf = !!raw && !!user && (raw === user.id || raw.toLowerCase() === user.username.toLowerCase());
  const viewUser = isSelf ? undefined : raw;

  if (viewMode === "global") {
    const { items, nowMs } = await readGlobalMesh(user);
    return (
      <Shell>
        <MeshField
          items={items}
          nowMs={nowMs}
          centre={{
            badge: String(items.filter((i) => i.kind === "person").length),
            text: "Everyone who's opted in, woven into one world.",
            action: { label: "Wander the Flow", href: "/flow" },
          }}
        />
      </Shell>
    );
  }

  if (viewUser) {
    const their = await readTheirMesh(viewUser, user);
    if (their.state === "missing") notFound();

    const name = their.owner.displayName || their.owner.username;
    if (their.state === "locked") {
      // Identity only. The old surface had a locked state too, and it said the
      // same amount: that this person exists and that this mesh is not open to
      // you. Anything more would be the leak the gate exists to prevent.
      return (
        <Shell>
          <MeshField
            items={[]}
            nowMs={Date.now()}
            centre={{
              badge: "—",
              text: `${name}'s mesh is private.`,
              action: { label: "View profile", href: `/profile/${their.owner.username}` },
            }}
          />
        </Shell>
      );
    }

    return (
      <Shell>
        <MeshField
          items={their.items}
          nowMs={their.nowMs}
          // Their mesh is their room: presence belongs to the mesh being
          // VIEWED, not to the viewer, which is how you see other people
          // standing in someone else's mesh alongside you.
          roomUserId={their.owner.id}
          viewerId={user?.id ?? null}
          centre={{
            badge: String(their.items.length),
            text: `${name}'s mesh`,
            action: { label: "View profile", href: `/profile/${their.owner.username}` },
          }}
        />
      </Shell>
    );
  }

  // Your own mesh. Signed out, there is no "you" to read obligations for, so
  // the world supply is the honest thing to show instead of an empty field.
  if (!user) {
    const { items, nowMs } = await readGlobalMesh(null);
    return (
      <Shell>
        <MeshField
          items={items}
          nowMs={nowMs}
          centre={{
            badge: String(items.filter((i) => i.kind === "person").length),
            text: "Everyone who's opted in, woven into one world.",
            action: { label: "Join the mesh", href: "/signup" },
          }}
        />
      </Shell>
    );
  }

  const { items, nowMs } = await readWantsYou(user.id);
  return (
    <Shell>
      <MeshField items={items} nowMs={nowMs} roomUserId={user.id} viewerId={user.id} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full">{children}</div>;
}
