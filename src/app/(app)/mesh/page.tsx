import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readGlobalMesh } from "@/lib/mesh/read-global-mesh";
import { readTheirMesh } from "@/lib/mesh/read-their-mesh";
import { readMyPresence } from "@/lib/mesh/read-my-presence";
import { MeshField } from "@/components/meshfield/mesh-field";
import { MeshRoom, type RoomProp } from "@/components/playground/mesh-room";

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
            nowMs={their.nowMs}
            centre={{
              badge: "—",
              text: `${name}'s mesh is private.`,
              action: { label: "View profile", href: `/profile/${their.owner.username}` },
            }}
          />
        </Shell>
      );
    }

    // VISITING IS WALKING INTO SOMEBODY'S ROOM. Their mesh is the same kind of
    // place yours is — you arrive with a body, their things are standing
    // around you, and anyone else visiting at the same moment is in there with
    // you. That last part is the entire point of a shared space, and it only
    // works because presence is scoped to the mesh being VIEWED rather than to
    // the viewer: everybody on /mesh?user=ada heartbeats into ada's room, so
    // they find each other there.
    return (
      <Shell>
        <MeshRoom
          roomUserId={their.owner.id}
          roomLabel={`${name}'s mesh`}
          viewerId={user?.id ?? null}
          props={propsFromItems(their.items)}
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

  // THE MESH IS A ROOM YOU STAND IN, not a chart about you. Your platforms and
  // recent things are furniture in it; you and everyone else here are bodies
  // that walk around them, and being seen is the point.
  const presence = await readMyPresence(user.id);
  return (
    <Shell>
      <MeshRoom
        roomUserId={user.id}
        roomLabel={`${user.displayName || user.username}'s mesh`}
        viewerId={user.id}
        props={propsFromPresence(presence)}
      />
    </Shell>
  );
}

/** The room's furniture, in fixed seats — same places every load, so it is
 * somewhere you can learn rather than a reshuffle on each visit. */
function propsFromPresence(presence: Awaited<ReturnType<typeof readMyPresence>>): RoomProp[] {
  const out: RoomProp[] = [];
  // THE DOOR TO YOUR INBOX, standing in your room.
  //
  // The unified inbox was built and then had no way in — a working page nobody
  // can navigate to, which the reachability gate is right to call the same
  // thing as a page that was never built. It belongs HERE rather than in the
  // nav: the mesh is the room you stand in, and the pile of things people are
  // waiting on from you is furniture in it. Only in your OWN room — a visitor
  // has no business seeing your mail.
  out.push({
    id: "inbox",
    label: presence.totalWantsYou > 0 ? `Inbox · ${presence.totalWantsYou} waiting` : "Inbox",
    vx: 0.5,
    vy: 0.1,
    href: "/inbox",
  });
  const arms = presence.arms.filter((a) => a.state !== "offer");
  arms.forEach((arm, i) => {
    const t = arms.length === 1 ? 0.5 : i / (arms.length - 1);
    out.push({
      id: `platform-${arm.platform}`,
      label: arm.handle ?? arm.platform,
      vx: 0.14 + t * 0.72,
      vy: 0.24,
      href: `/connected-accounts#${arm.platform}`,
    });
    arm.items.slice(0, 2).forEach((item, j) => {
      out.push({
        id: item.id,
        label: item.title,
        vx: 0.14 + t * 0.72 + (j === 0 ? -0.05 : 0.05),
        vy: 0.44 + j * 0.1,
        href: item.href,
        imageUrl: item.imageUrl,
      });
    });
  });
  return out;
}

/** How many of their things stand in the room. Past this it stops being a
 * place you can move through and becomes a wall of thumbnails. */
const VISIT_PROPS = 12;

/** Their mesh's furniture, laid out in fixed seats.
 *
 * Deterministic on purpose — index-driven, never random and never time-driven,
 * so the server and the client agree and so the room is somewhere you can
 * learn. Two rows above the floor line, which keeps the lower half clear as
 * the space bodies actually walk around in. */
function propsFromItems(items: readonly { id: string; title: string; href?: string; imageUrl?: string | null }[]): RoomProp[] {
  const shown = items.slice(0, VISIT_PROPS);
  const perRow = Math.max(1, Math.ceil(shown.length / 2));
  return shown.map((item, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const span = perRow === 1 ? 0 : col / (perRow - 1);
    return {
      id: item.id,
      label: item.title,
      // Rows are offset from one another so a short second row does not sit
      // directly under the first and read as a column.
      vx: 0.13 + span * 0.74 + (row === 1 ? 0.03 : 0),
      vy: row === 0 ? 0.24 : 0.44,
      href: item.href,
      imageUrl: item.imageUrl,
    };
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full">{children}</div>;
}
