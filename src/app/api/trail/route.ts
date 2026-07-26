import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BRANCH_PLASTIC, MOULD } from "@/lib/palette";
import { rateLimit } from "@/lib/security";

// Your monthly Trail: the literal path you traveled through the mesh — every
// post you made, heart you threw, comment you left, person you connected
// with, and thing you published elsewhere, in the order it happened. Built
// ONLY from the viewer's own activity and visible ONLY to them.

export type TrailStepType = "post" | "like" | "comment" | "follow" | "sync" | "message";

// A THIRD copy of the mesh's old Tailwind-400 palette lived here — #34d399,
// #38bdf8, #a78bfa, #f59e0b, all within a few degrees of a plastic the product
// already owned. Each step type now takes the plastic of the mesh branch it
// belongs to, so a green dot means the same thing on the Trail as on the mesh.
const STEP_COLORS: Record<TrailStepType, string> = {
  post: MOULD[BRANCH_PLASTIC.posts].fill,
  like: MOULD[BRANCH_PLASTIC.activity].fill,
  comment: MOULD[BRANCH_PLASTIC.people].fill,
  follow: MOULD[BRANCH_PLASTIC.communities].fill,
  sync: MOULD[BRANCH_PLASTIC.platforms].fill,
  message: MOULD[BRANCH_PLASTIC.identities].fill,
};

const MAX_STEPS = 48;

function truncate(value: string | null | undefined, max: number): string {
  const trimmed = (value || "").trim().replace(/\s+/g, " ");
  return trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + "…" : trimmed;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // This endpoint isn't in the proxy's protected prefixes and runs several heavy
  // queries per call, so throttle it in-handler.
  if (!rateLimit(`trail:${user.id}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  // "Your Year" — the same trail across twelve months, a MeshPro view.
  const yearMode = searchParams.get("range") === "year";
  if (yearMode && !user.isMeshPro) {
    return NextResponse.json({ error: "Your Year is a MeshPro view." }, { status: 403 });
  }

  let year = now.getFullYear();
  let monthIndex = now.getMonth();
  let start: Date;
  let end: Date;
  if (yearMode) {
    const yr = searchParams.get("year");
    if (yr && /^\d{4}$/.test(yr)) year = Number(yr);
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
    if (start > now) return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  } else {
    const monthParam = searchParams.get("month");
    const m = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null;
    if (m) {
      year = Number(m[1]);
      monthIndex = Number(m[2]) - 1;
    }
    start = new Date(year, monthIndex, 1);
    end = new Date(year, monthIndex + 1, 1);
    if (!Number.isFinite(start.getTime()) || monthIndex < 0 || monthIndex > 11 || start > now) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
  }
  const range = { gte: start, lt: end };

  const [posts, reactions, comments, follows, messages, accounts, postTotal, heartTotal, commentTotal, followTotal, messageTotal] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id, createdAt: range },
      select: {
        id: true,
        content: true,
        createdAt: true,
        _count: { select: { reactions: true, comments: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.reaction.findMany({
      where: { userId: user.id, createdAt: range },
      select: {
        id: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            author: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 400,
    }),
    prisma.comment.findMany({
      where: { authorId: user.id, createdAt: range },
      select: {
        id: true,
        content: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            author: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 400,
    }),
    prisma.follow.findMany({
      where: { followerId: user.id, createdAt: range },
      select: {
        id: true,
        createdAt: true,
        following: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.message.findMany({
      where: { senderId: user.id, createdAt: range },
      select: { id: true, threadId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        platform: true,
        platformPosts: {
          where: { publishedAt: range },
          select: { id: true, title: true, content: true, publishedAt: true, url: true },
          orderBy: { publishedAt: "asc" },
          take: 100,
        },
      },
    }),
    // True period totals for the summary headline. The findMany queries above are
    // capped (take), so their `.length` saturates and under-reports active users.
    prisma.post.count({ where: { authorId: user.id, createdAt: range } }),
    prisma.reaction.count({ where: { userId: user.id, createdAt: range } }),
    prisma.comment.count({ where: { authorId: user.id, createdAt: range } }),
    prisma.follow.count({ where: { followerId: user.id, createdAt: range } }),
    prisma.message.count({ where: { senderId: user.id, createdAt: range } }),
  ]);

  type Step = {
    id: string;
    type: TrailStepType;
    at: string;
    title: string;
    subtitle: string | null;
    color: string;
    href: string | null;
  };

  const steps: Step[] = [];

  for (const p of posts) {
    steps.push({
      id: `post-${p.id}`,
      type: "post",
      at: p.createdAt.toISOString(),
      title: `You posted “${truncate(p.content, 44) || "…"}”`,
      subtitle:
        p._count.reactions + p._count.comments > 0
          ? `${p._count.reactions} ♥ · ${p._count.comments} comments so far`
          : null,
      color: STEP_COLORS.post,
      href: `/feed/${p.id}`,
    });
  }
  for (const r of reactions) {
    const who = r.post.author.displayName || "@" + r.post.author.username;
    steps.push({
      id: `like-${r.id}`,
      type: "like",
      at: r.createdAt.toISOString(),
      title: `You threw a heart at ${who}'s post`,
      subtitle: truncate(r.post.content, 52) || null,
      color: STEP_COLORS.like,
      href: `/feed/${r.post.id}`,
    });
  }
  for (const c of comments) {
    const who = c.post.author.displayName || "@" + c.post.author.username;
    steps.push({
      id: `comment-${c.id}`,
      type: "comment",
      at: c.createdAt.toISOString(),
      title: `You commented on ${who}'s post`,
      subtitle: truncate(c.content, 52) || null,
      color: STEP_COLORS.comment,
      href: `/feed/${c.post.id}`,
    });
  }
  for (const f of follows) {
    const who = f.following.displayName || "@" + f.following.username;
    steps.push({
      id: `follow-${f.id}`,
      type: "follow",
      at: f.createdAt.toISOString(),
      title: `${who} entered your world`,
      subtitle: "You followed them",
      color: STEP_COLORS.follow,
      href: `/profile/${f.following.username}`,
    });
  }
  for (const acct of accounts) {
    for (const pp of acct.platformPosts) {
      if (!pp.publishedAt) continue;
      steps.push({
        id: `sync-${pp.id}`,
        type: "sync",
        at: pp.publishedAt.toISOString(),
        title: `You published on ${acct.platform}`,
        subtitle: truncate(pp.title || pp.content, 52) || null,
        color: STEP_COLORS.sync,
        href: `/feed/platform-${pp.id}`,
      });
    }
  }
  // Messages fold into one step per conversation-day so the trail shows the
  // shape of your conversations without replaying every text.
  const msgDays = new Map<string, { count: number; at: string }>();
  for (const msg of messages) {
    const key = `${msg.threadId}:${msg.createdAt.toISOString().slice(0, 10)}`;
    const cur = msgDays.get(key);
    if (cur) cur.count += 1;
    else msgDays.set(key, { count: 1, at: msg.createdAt.toISOString() });
  }
  for (const [key, v] of msgDays) {
    steps.push({
      id: `message-${key}`,
      type: "message",
      at: v.at,
      title: v.count === 1 ? "You sent a message" : `You sent ${v.count} messages in a conversation`,
      subtitle: null,
      color: STEP_COLORS.message,
      href: "/messages",
    });
  }

  steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // People you spent the month around, by how often your path crossed theirs.
  const peopleTouches = new Map<string, { name: string; count: number }>();
  const touch = (id: string, name: string) => {
    const cur = peopleTouches.get(id);
    if (cur) cur.count += 1;
    else peopleTouches.set(id, { name, count: 1 });
  };
  for (const r of reactions) {
    if (r.post.author.id !== user.id) touch(r.post.author.id, r.post.author.displayName || "@" + r.post.author.username);
  }
  for (const c of comments) {
    if (c.post.author.id !== user.id) touch(c.post.author.id, c.post.author.displayName || "@" + c.post.author.username);
  }
  for (const f of follows) touch(f.following.id, f.following.displayName || "@" + f.following.username);
  const topPeople = [...peopleTouches.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  const dayCounts = new Map<string, number>();
  for (const s of steps) {
    const day = s.at.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  let busiestDay: string | null = null;
  let busiestCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > busiestCount) {
      busiestDay = day;
      busiestCount = count;
    }
  }

  const total = steps.length;
  // Cap the drawn trail; sample evenly so the whole month stays represented.
  let shown = steps;
  if (steps.length > MAX_STEPS) {
    shown = [];
    for (let i = 0; i < MAX_STEPS; i += 1) {
      shown.push(steps[Math.floor((i * steps.length) / MAX_STEPS)]);
    }
  }

  const label = yearMode
    ? `Your ${year}`
    : start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = yearMode
    ? year === now.getFullYear()
    : year === now.getFullYear() && monthIndex === now.getMonth();
  const prev = new Date(year, monthIndex - 1, 1);

  return NextResponse.json({
    range: yearMode ? "year" : "month",
    month: yearMode ? String(year) : `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    label,
    isCurrentMonth,
    prevMonth: yearMode
      ? String(year - 1)
      : `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`,
    nextMonth: isCurrentMonth
      ? null
      : yearMode
        ? String(year + 1)
        : `${new Date(year, monthIndex + 1, 1).getFullYear()}-${String(new Date(year, monthIndex + 1, 1).getMonth() + 1).padStart(2, "0")}`,
    steps: shown,
    summary: {
      totalMoments: total,
      posts: postTotal,
      hearts: heartTotal,
      comments: commentTotal,
      newPeople: followTotal,
      published: accounts.reduce((sum, a) => sum + a.platformPosts.length, 0),
      messages: messageTotal,
      activeDays: dayCounts.size,
      busiestDay,
      busiestCount,
      topPeople,
    },
  });
}
