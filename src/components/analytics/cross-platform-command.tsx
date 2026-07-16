import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Crown, Flame, Gauge, Layers, Rocket, Scale, Trophy, Zap } from "lucide-react";
import type { AnalyticsDashboardData } from "@/lib/analytics-dashboard";

/**
 * The cross-platform command center: mesh.me is the only place that can see a
 * creator's ENTIRE footprint at once, so this section answers the questions
 * no single platform can — where your audience actually lives, which platform
 * works hardest per post, and how your worlds compare side by side.
 */

const PLATFORM_TONES: Record<string, string> = {
  youtube: "#ef4444",
  instagram: "#ec4899",
  tiktok: "#a1a1aa",
  twitter: "#38bdf8",
  x: "#a1a1aa",
  reddit: "#f97316",
  facebook: "#3b82f6",
  snapchat: "#facc15",
  twitch: "#a855f7",
  spotify: "#22c55e",
  "mesh.me": "#2f7cff",
  meshme: "#2f7cff",
};

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (v: number | null | undefined) => compact.format(Math.max(0, Math.round(v || 0)));

function tone(platform: string) {
  return PLATFORM_TONES[platform.toLowerCase()] || "#818cf8";
}

function label(platform: string) {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return "X";
  if (p === "meshme" || p === "mesh.me") return "mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

type Comparison = AnalyticsDashboardData["platformComparison"][number];

type MixRow = {
  key: string;
  title: string;
  total: number;
  parts: Array<{ platform: string; value: number }>;
};

function ShareBar({ row }: { row: MixRow }) {
  const visible = row.parts.filter((part) => part.value > 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{row.title}</p>
        <p className="text-xs font-bold text-[var(--text-primary)]">{fmt(row.total)}</p>
      </div>
      <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]/70">
        {visible.length > 0 ? (
          visible.map((part) => (
            <span
              key={part.platform}
              title={`${label(part.platform)} · ${fmt(part.value)} (${Math.round((part.value / row.total) * 100)}%)`}
              style={{ width: `${Math.max(2, (part.value / row.total) * 100)}%`, backgroundColor: tone(part.platform) }}
              className="h-full first:rounded-l-full last:rounded-r-full"
            />
          ))
        ) : (
          <span className="h-full w-full" />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {visible.map((part) => (
          <span key={part.platform} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone(part.platform) }} />
            {label(part.platform)} {Math.round((part.value / row.total) * 100)}%
          </span>
        ))}
        {visible.length === 0 && <span className="text-[10px] text-[var(--text-muted)]">No data synced yet</span>}
      </div>
    </div>
  );
}

function LeaderCard({ icon: Icon, title, platform, stat, detail }: { icon: LucideIcon; title: string; platform: string | null; stat: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        <Icon size={12} aria-hidden="true" />
        {title}
      </p>
      {platform ? (
        <>
          <p className="mt-1.5 flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone(platform) }} />
            {label(platform)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{stat}</span> {detail}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">Connect platforms to unlock</p>
      )}
    </div>
  );
}

export function CrossPlatformCommand({ data }: { data: AnalyticsDashboardData }) {
  const platforms: Comparison[] = data.platformComparison;
  const nativeAudience = data.personal.followers;
  const nativeEngagement = data.overview.totalEngagement - platforms.reduce(
    (t, p) => t + p.totalLikes + p.totalComments + p.totalShares,
    0,
  );

  const audienceParts = [
    { platform: "mesh.me", value: nativeAudience },
    ...platforms.map((p) => ({ platform: p.platform, value: p.followerCount })),
  ];
  const viewParts = platforms.map((p) => ({ platform: p.platform, value: p.totalViews }));
  const engagementParts = [
    { platform: "mesh.me", value: Math.max(0, nativeEngagement) },
    ...platforms.map((p) => ({ platform: p.platform, value: p.totalLikes + p.totalComments + p.totalShares })),
  ];
  const contentParts = [
    { platform: "mesh.me", value: data.overview.nativePosts },
    ...platforms.map((p) => ({ platform: p.platform, value: p.postCount })),
  ];

  const mkRow = (key: string, title: string, parts: Array<{ platform: string; value: number }>): MixRow => ({
    key,
    title,
    parts: parts.sort((a, b) => b.value - a.value),
    total: parts.reduce((t, p) => t + p.value, 0),
  });

  const rows = [
    mkRow("audience", "Audience — where your people are", audienceParts),
    mkRow("views", "Views — where you get seen", viewParts),
    mkRow("engagement", "Engagement — where people respond", engagementParts),
    mkRow("content", "Content — where you publish", contentParts),
  ];

  const byReach = platforms.slice().sort((a, b) => b.followerCount - a.followerCount)[0] || null;
  const byViews = platforms.slice().sort((a, b) => b.totalViews - a.totalViews)[0] || null;
  const byRate = platforms
    .filter((p) => p.followerCount > 0 || p.totalViews > 0)
    .slice()
    .sort((a, b) => b.engagementRate - a.engagementRate)[0] || null;
  const byGrowth = platforms.slice().sort((a, b) => b.followerGrowth - a.followerGrowth)[0] || null;
  const perPost = platforms
    .filter((p) => p.postCount > 0)
    .map((p) => ({ ...p, epp: (p.totalLikes + p.totalComments + p.totalShares) / p.postCount }))
    .sort((a, b) => b.epp - a.epp);
  const hardestWorking = perPost[0] || null;

  const maxEpp = Math.max(1, ...perPost.map((p) => p.epp));

  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            <Layers size={12} aria-hidden="true" />
            Only on mesh.me
          </p>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">Your whole internet, side by side</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Every platform reports its own numbers. This is the only view where they meet.
          </p>
        </div>
        <Link
          href="/connected-accounts"
          className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
        >
          Connect more platforms
        </Link>
      </div>

      {/* Leaders — which platform wins each crown */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <LeaderCard icon={Crown} title="Biggest audience" platform={byReach?.platform ?? null} stat={fmt(byReach?.followerCount)} detail="followers" />
        <LeaderCard icon={Trophy} title="Most reach" platform={byViews?.platform ?? null} stat={fmt(byViews?.totalViews)} detail="views" />
        <LeaderCard icon={Flame} title="Best engagement rate" platform={byRate?.platform ?? null} stat={`${((byRate?.engagementRate || 0) * 100).toFixed(1)}%`} detail="of audience responds" />
        <LeaderCard icon={Rocket} title="Fastest growing" platform={byGrowth && byGrowth.followerGrowth > 0 ? byGrowth.platform : null} stat={`+${fmt(byGrowth?.followerGrowth)}`} detail="followers this month" />
        <LeaderCard icon={Zap} title="Hardest working" platform={hardestWorking?.platform ?? null} stat={fmt(hardestWorking?.epp)} detail="engagements per post" />
      </div>

      {/* The mix — stacked share bars */}
      <div className="mt-4 grid gap-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 p-4 md:grid-cols-2">
        {rows.map((row) => (
          <ShareBar key={row.key} row={row} />
        ))}
      </div>

      {/* Engagement per post — which platform repays your effort */}
      {perPost.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <Scale size={13} aria-hidden="true" />
            Engagement earned per post
          </p>
          <div className="mt-3 grid gap-2.5">
            {perPost.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 truncate text-xs font-semibold text-[var(--text-primary)]">{label(p.platform)}</span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(3, (p.epp / maxEpp) * 100)}%`, backgroundColor: tone(p.platform) }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-xs font-bold text-[var(--text-primary)]">{fmt(p.epp)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Gauge size={12} aria-hidden="true" />
            {hardestWorking
              ? `A post on ${label(hardestWorking.platform)} earns ${fmt(hardestWorking.epp)} engagements on average — ${
                  perPost.length > 1 && perPost[perPost.length - 1].epp > 0
                    ? `${Math.max(1, Math.round(hardestWorking.epp / perPost[perPost.length - 1].epp))}× more than ${label(perPost[perPost.length - 1].platform)}`
                    : "your strongest return per post"
                }.`
              : "Sync platform content to compare effort vs. return."}
          </p>
        </div>
      )}
    </section>
  );
}
