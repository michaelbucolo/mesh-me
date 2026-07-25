"use client";

import Link from "next/link";
import { useRef, type CSSProperties } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Crown, Fingerprint, Flame, Gauge, Layers, Rocket, Scale, Trophy, Zap } from "lucide-react";
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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{row.title}</p>
        <p className="text-xs font-semibold text-[var(--text-primary)]">{fmt(row.total)}</p>
      </div>
      <div ref={ref} className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]/70">
        {visible.length > 0 ? (
          visible.map((part, i) => {
            const w = Math.max(2, (part.value / row.total) * 100);
            return (
              <motion.span
                key={part.platform}
                title={`${label(part.platform)} · ${fmt(part.value)} (${Math.round((part.value / row.total) * 100)}%)`}
                style={{ backgroundColor: tone(part.platform) }}
                className="h-full first:rounded-l-full last:rounded-r-full"
                initial={reduce ? false : { width: "0%" }}
                animate={inView || reduce ? { width: `${w}%` } : { width: "0%" }}
                transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })
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

function LeaderCard({ icon: Icon, title, platform, stat, detail, index }: { icon: LucideIcon; title: string; platform: string | null; stat: string; detail: string; index?: number }) {
  return (
    <div
      className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3.5"
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold mesh-eyebrow text-[var(--text-muted)]">
        <Icon size={12} aria-hidden="true" />
        {title}
      </p>
      {platform ? (
        <>
          <p className="mt-1.5 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
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

/** One "engagement per post" bar that grows into place when scrolled into view. */
function PerPostBar({ platform, epp, maxEpp, index }: { platform: string; epp: number; maxEpp: number; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const reduce = useReducedMotion();
  const w = Math.max(3, (epp / maxEpp) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs font-semibold text-[var(--text-primary)]">{label(platform)}</span>
      <div ref={ref} className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <motion.span
          className="block h-full rounded-full"
          style={{ backgroundColor: tone(platform) }}
          initial={reduce ? false : { width: "0%" }}
          animate={inView || reduce ? { width: `${w}%` } : { width: "0%" }}
          transition={{ duration: reduce ? 0 : 0.75, delay: reduce ? 0 : index * 0.07, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold text-[var(--text-primary)]">{fmt(epp)}</span>
    </div>
  );
}

/**
 * The one thing no single platform can tell you: which real people follow you
 * in more than one place. Computed by matching handles across your synced
 * followers — presented honestly as a lower bound ("fans we've found"), with a
 * graceful state when fewer than two platforms have follower data yet.
 */
function CrossPlatformFans({ overlap }: { overlap: AnalyticsDashboardData["audienceOverlap"] }) {
  return (
    <div className="mt-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold mesh-eyebrow text-[var(--accent)]">
        <Fingerprint size={12} aria-hidden="true" />
        Your true fans
      </p>
      <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Who follows you everywhere</h3>

      {!overlap.hasEnoughData ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Connect and sync followers on at least two platforms to see who follows you in more than one place.
        </p>
      ) : overlap.multiPlatformCount === 0 ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          No overlapping followers found yet across your synced followers. As more sync in, your cross-platform fans
          will show up here.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            <span className="text-base font-semibold text-[var(--text-primary)]">{fmt(overlap.multiPlatformCount)}</span>{" "}
            {overlap.multiPlatformCount === 1 ? "person follows" : "people follow"} you on more than one platform.
          </p>
          {overlap.superfans.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {overlap.superfans.map((fan, i) => {
                const inner = (
                  <>
                    {fan.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fan.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-muted)]">
                        {(fan.name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">
                      {fan.name || "Someone"}
                    </span>
                    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                      {fan.platforms.map((p) => (
                        <span key={p} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone(p) }} title={label(p)} />
                      ))}
                    </span>
                  </>
                );
                return (
                  <li key={i}>
                    {fan.profileUrl ? (
                      <a
                        href={fan.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-[var(--bg-secondary)]"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2.5 px-1.5 py-1">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <p className="mt-3 text-[10px] leading-snug text-[var(--text-muted)]">
        Matched by username across your synced followers (exact matches only) — a lower bound, not your full audience.
      </p>
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
          <p className="flex items-center gap-1.5 text-[10px] font-semibold mesh-eyebrow text-[var(--accent)]">
            <Layers size={12} aria-hidden="true" />
            Only on mesh.me
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Your whole internet, side by side</h2>
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
      <div className="mesh-cascade mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <LeaderCard index={0} icon={Crown} title="Biggest audience" platform={byReach?.platform ?? null} stat={fmt(byReach?.followerCount)} detail="followers" />
        <LeaderCard index={1} icon={Trophy} title="Most reach" platform={byViews?.platform ?? null} stat={fmt(byViews?.totalViews)} detail="views" />
        <LeaderCard index={2} icon={Flame} title="Best engagement rate" platform={byRate?.platform ?? null} stat={`${((byRate?.engagementRate || 0) * 100).toFixed(1)}%`} detail="of audience responds" />
        <LeaderCard index={3} icon={Rocket} title="Fastest growing" platform={byGrowth && byGrowth.followerGrowth > 0 ? byGrowth.platform : null} stat={`+${fmt(byGrowth?.followerGrowth)}`} detail="followers this month" />
        <LeaderCard index={4} icon={Zap} title="Hardest working" platform={hardestWorking?.platform ?? null} stat={fmt(hardestWorking?.epp)} detail="engagements per post" />
      </div>

      {/* The mix — stacked share bars */}
      <div className="mt-4 grid gap-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 p-4 md:grid-cols-2">
        {rows.map((row) => (
          <ShareBar key={row.key} row={row} />
        ))}
      </div>

      {/* Cross-platform superfans — the deduplicated counterpart to the Audience
          bar above: who your summed audience actually shares. */}
      <CrossPlatformFans overlap={data.audienceOverlap} />

      {/* Engagement per post — which platform repays your effort */}
      {perPost.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <Scale size={13} aria-hidden="true" />
            Engagement earned per post
          </p>
          <div className="mt-3 grid gap-2.5">
            {perPost.map((p, i) => (
              <PerPostBar key={p.id} platform={p.platform} epp={p.epp} maxEpp={maxEpp} index={i} />
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
