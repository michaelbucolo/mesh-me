import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readGlobalMesh } from "@/lib/mesh/read-global-mesh";
import { readTheirMesh } from "@/lib/mesh/read-their-mesh";
import { readMyPresence } from "@/lib/mesh/read-my-presence";
import { MeshField } from "@/components/meshfield/mesh-field";
import { readMyFriends, type MeshFriend } from "@/lib/mesh/read-my-friends";
import { layoutWeb, threadsFor, type WebNodeInput } from "@/lib/mesh/web-layout";
import { MeshRoom, type RoomProp, type RoomThread } from "@/components/playground/mesh-room";

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
  // Your accounts, your posts, AND your friends — the three things the mesh is
  // a web OF. Friends were absent entirely until now, so a third of it was
  // missing by its own definition. Read in parallel: neither depends on the
  // other, and this is a server component, so it is one round trip.
  const [presence, friends] = await Promise.all([readMyPresence(user.id), readMyFriends(user)]);
  const web = buildMyWeb(presence, friends);
  return (
    <Shell>
      <MeshRoom
        roomUserId={user.id}
        roomLabel={`${user.displayName || user.username}'s mesh`}
        viewerId={user.id}
        props={web.props}
        threads={web.threads}
      />
    </Shell>
  );
}

/**
 * YOUR MESH AS A WEB — accounts, the posts that came out of them, and your
 * friends, joined by threads that mean something.
 *
 * ── WHY THIS REPLACED `propsFromPresence` RATHER THAN EXTENDING IT ─────────
 *
 * The old function promised "fixed seats — same places every load, so it is
 * somewhere you can learn" and then computed `t = i / (arms.length - 1)`,
 * which makes a seat a function of HOW MANY accounts you have. Connecting a
 * fifth moved the other four. The promise in the comment was false, and a
 * place whose furniture rearranges itself is not one you can learn.
 *
 * Position now comes from RANK alone (mesh/web-layout), so your oldest account
 * keeps slot 0 forever and adding something never moves something else. That
 * property has a gate of its own, because nothing else can see it.
 *
 * ── AND WHY IT IS NOT A DIAGRAM ────────────────────────────────────────────
 *
 * mesh-room.tsx's header records that three attempts at this surface were
 * infographics, and names "a hub of platforms" as the second. Threads
 * radiating from your avatar at the centre would be that same chart again. So
 * nothing sits at the centre and nothing radiates: the layout is bands you
 * walk between, and the threads run between things that are genuinely
 * related — a post to the account it came from, a friend to their latest
 * thing. The web is the shape of the room, not a picture hung inside it.
 */
function buildMyWeb(
  presence: Awaited<ReturnType<typeof readMyPresence>>,
  friends: MeshFriend[],
): { props: RoomProp[]; threads: RoomThread[] } {
  const nodes: WebNodeInput[] = [];

  // TWO DOORS, in your own room and nobody else's. The nav is five tabs by
  // direction; neither of these earns a sixth, and the mesh IS the room you
  // stand in, so the pile of things people are waiting on and the way out to
  // find people are furniture in it.
  nodes.push({ id: "door-inbox", kind: "door", rank: 0, label: "Inbox", href: "/inbox",
    detail: presence.totalWantsYou > 0 ? `${presence.totalWantsYou} waiting` : null });
  nodes.push({ id: "door-map", kind: "door", rank: 1, label: "MeshiMap", href: "/meshimap",
    detail: "who's nearby" });

  // Accounts, oldest first. `state !== "offer"` keeps unconnected platforms
  // out of the web — an offer is an invitation, not part of your presence.
  const arms = presence.arms.filter((a) => a.state !== "offer");
  arms.forEach((arm, i) => {
    const accountId = `account-${arm.platform}`;
    nodes.push({
      id: accountId,
      kind: "account",
      rank: i,
      label: arm.handle ?? arm.platform,
      detail: arm.platform,
      href: `/connected-accounts#${arm.platform}`,
    });
    // The posts that came out of THAT account, threaded to it. This relation
    // already existed in the old code and was thrown away: both the arm and
    // its items were pushed into one flat array, so nothing downstream could
    // ever know which post belonged to which account.
    arm.items.slice(0, 2).forEach((item, j) => {
      nodes.push({
        id: item.id,
        kind: "post",
        rank: i * 2 + j,
        label: item.title,
        href: item.href,
        imageUrl: item.imageUrl,
        parentId: accountId,
      });
    });
  });

  // Your friends, and the last thing each of them put out, threaded to them.
  friends.forEach((friend) => {
    const friendId = `friend-${friend.userId}`;
    nodes.push({
      id: friendId,
      kind: "friend",
      rank: friend.rank,
      label: friend.displayName || friend.username,
      detail: `@${friend.username}`,
      href: `/mesh?user=${encodeURIComponent(friend.username)}`,
      imageUrl: friend.avatarUrl,
    });
    if (friend.latest) {
      nodes.push({
        id: friend.latest.id,
        // Its OWN kind, so it sits in the band directly under its friend.
        // Sharing the "post" band with your own posts sent every friend-thread
        // diagonally across the account layer and the room read as a tangle.
        kind: "friendPost",
        // Same rank as the friend, so it lands in their column.
        rank: friend.rank,
        label: friend.latest.title,
        href: friend.latest.href,
        imageUrl: friend.latest.imageUrl,
        parentId: friendId,
      });
    }
  });

  const laid = layoutWeb(nodes);
  return {
    props: laid.map((v) => ({
      id: v.id,
      label: v.label,
      vx: v.vx,
      vy: v.vy,
      href: v.href,
      imageUrl: v.imageUrl,
      kind: v.kind,
      detail: v.detail,
    })),
    threads: threadsFor(laid).map((t) => ({
      fromVx: t.fromVx,
      fromVy: t.fromVy,
      toVx: t.toVx,
      toVy: t.toVy,
    })),
  };
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
