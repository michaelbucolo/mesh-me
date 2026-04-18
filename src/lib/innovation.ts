import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface InnovationMetric {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "steady";
}

export interface InnovationIdea {
  title: string;
  description: string;
  impact: "High" | "Medium" | "Low";
  effort: "High" | "Medium" | "Low";
}

export interface InnovationBrief {
  metrics: InnovationMetric[];
  recommendations: InnovationIdea[];
  topTags: string[];
  peakPostingWindow: string;
}

function percentDiff(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function toWindowLabel(hour: number) {
  const start = hour % 24;
  const end = (hour + 2) % 24;
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
  });

  const startLabel = formatter.format(new Date(Date.UTC(2024, 0, 1, start)));
  const endLabel = formatter.format(new Date(Date.UTC(2024, 0, 1, end)));

  return `${startLabel} - ${endLabel}`;
}

export async function getInnovationBrief(userId: string): Promise<InnovationBrief> {
  const now = new Date();
  const last30 = subDays(now, 30);
  const prev30 = subDays(now, 60);

  const [
    postsCurrent,
    postsPrevious,
    commentsCurrent,
    commentsPrevious,
    reactionsCurrent,
    reactionsPrevious,
    memberships,
    postTags,
    authoredPosts,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, createdAt: { gte: last30 } } }),
    prisma.post.count({ where: { authorId: userId, createdAt: { gte: prev30, lt: last30 } } }),
    prisma.comment.count({ where: { authorId: userId, createdAt: { gte: last30 } } }),
    prisma.comment.count({ where: { authorId: userId, createdAt: { gte: prev30, lt: last30 } } }),
    prisma.reaction.count({ where: { createdAt: { gte: last30 }, post: { authorId: userId } } }),
    prisma.reaction.count({ where: { createdAt: { gte: prev30, lt: last30 }, post: { authorId: userId } } }),
    prisma.communityMember.count({ where: { userId } }),
    prisma.postTag.findMany({
      where: { post: { authorId: userId } },
      select: { tag: true },
      take: 200,
      orderBy: { id: "desc" },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      select: { createdAt: true },
      take: 120,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tagCounts = postTags.reduce<Record<string, number>>((acc, item) => {
    const key = item.tag.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag);

  const hourBuckets = authoredPosts.reduce<number[]>((acc, post) => {
    const hour = post.createdAt.getUTCHours();
    acc[hour] = (acc[hour] ?? 0) + 1;
    return acc;
  }, Array.from({ length: 24 }, () => 0));

  const peakHour = hourBuckets.reduce((bestHour, count, hour) => {
    if (count > hourBuckets[bestHour]) return hour;
    return bestHour;
  }, 18);

  const postDelta = percentDiff(postsCurrent, postsPrevious);
  const commentDelta = percentDiff(commentsCurrent, commentsPrevious);
  const reactionsDelta = percentDiff(reactionsCurrent, reactionsPrevious);

  const metrics: InnovationMetric[] = [
    {
      label: "Creative output",
      value: compactNumber(postsCurrent),
      delta: `${postDelta >= 0 ? "+" : ""}${postDelta}% vs prior 30d`,
      trend: postDelta > 3 ? "up" : postDelta < -3 ? "down" : "steady",
    },
    {
      label: "Conversation sparks",
      value: compactNumber(commentsCurrent),
      delta: `${commentDelta >= 0 ? "+" : ""}${commentDelta}% vs prior 30d`,
      trend: commentDelta > 3 ? "up" : commentDelta < -3 ? "down" : "steady",
    },
    {
      label: "Audience resonance",
      value: compactNumber(reactionsCurrent),
      delta: `${reactionsDelta >= 0 ? "+" : ""}${reactionsDelta}% vs prior 30d`,
      trend: reactionsDelta > 3 ? "up" : reactionsDelta < -3 ? "down" : "steady",
    },
    {
      label: "Community footprint",
      value: compactNumber(memberships),
      delta: memberships > 0 ? "Active across communities" : "Join your first community",
      trend: memberships > 0 ? "up" : "steady",
    },
  ];

  const recommendations: InnovationIdea[] = [
    {
      title: "Double-down content lane",
      description:
        topTags.length > 0
          ? `You get repeated traction around #${topTags[0]}. Launch a 5-post mini-series and add a weekly recap thread.`
          : "Start with a recurring topic series (3-5 posts) to build pattern recognition and anticipation.",
      impact: "High",
      effort: "Medium",
    },
    {
      title: "Prime-time publishing",
      description: `Your strongest posting window appears around ${toWindowLabel(peakHour)} UTC. Schedule your highest-value posts there.`,
      impact: "Medium",
      effort: "Low",
    },
    {
      title: "Community bridge campaign",
      description:
        memberships >= 2
          ? "Cross-post one insight adapted for each community and ask one specific feedback question to trigger quality replies."
          : "Join two aligned communities and share one tailored kickoff post in each to accelerate discovery.",
      impact: "High",
      effort: "Medium",
    },
  ];

  return {
    metrics,
    recommendations,
    topTags,
    peakPostingWindow: toWindowLabel(peakHour),
  };
}
