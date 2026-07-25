"use client";

import Link from "next/link";
import { effectiveProfileVisibility } from "@/lib/profile-visibility";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  CheckCircle2,
  Clock3,
  Crown,
  Eye,
  FileText,
  Fingerprint,
  Gauge,
  Heart,
  LockKeyhole,
  MessageCircle,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  XCircle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { AnalyticsControls } from "@/components/analytics/analytics-controls";
import { CrossPlatformCommand } from "@/components/analytics/cross-platform-command";
import { PrivacyPermissionsManager } from "@/components/analytics/privacy-permissions-manager";
import type { AnalyticsDashboardData } from "@/lib/analytics-dashboard";

type ChartPoint = AnalyticsDashboardData["charts"]["engagement"][number];

const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const cf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const fmt = (v: number | null | undefined) => nf.format(Math.round(v || 0));
const compact = (v: number | null | undefined) => cf.format(Math.max(0, Math.round(v || 0)));
// Tiny audiences can produce mathematically true but absurd-looking rates
// (3 engagements / 1 follower). Cap the display — nobody needs "600%".
const pct = (v: number | null | undefined) => `${(Math.min(1, Math.max(0, v || 0)) * 100).toFixed(1)}%`;

function duration(seconds: number | null | undefined) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(s < 36000 ? 1 : 0)}h`;
}

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
  github: "#8b949e",
  "mesh.me": "#2f7cff",
  meshme: "#2f7cff",
};

function toneFor(platform: string) {
  return PLATFORM_TONES[platform.toLowerCase()] || "#818cf8";
}

function labelFor(platform: string) {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return "X";
  if (p === "meshme" || p === "mesh.me") return "mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * A number that springs up from 0 the first time it scrolls into view.
 * Falls back to the final formatted string under reduced motion.
 */
function AnimatedNumber({ value, target, format }: { value: string; target: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 70, damping: 18, restDelta: 0.4 });
  const [display, setDisplay] = useState(format(0));

  useEffect(() => {
    // Reduced motion: skip the spring entirely — the final value is rendered
    // directly below, so no setState is needed in this effect.
    if (!reduce && inView) mv.set(target);
  }, [inView, target, reduce, mv]);

  useEffect(() => {
    if (reduce) return;
    const unsubscribe = spring.on("change", (v) => {
      // Snap to the canonical formatted string once it has essentially arrived.
      setDisplay(Math.abs(target - v) < 0.5 ? value : format(v));
    });
    return () => unsubscribe();
  }, [spring, format, target, value, reduce]);

  return <span ref={ref}>{reduce ? value : display}</span>;
}

/** Tiny area sparkline — trend at a glance, no axes, no chrome. Strokes itself in on view. */
function Sparkline({ points, tone = "#2f7cff" }: { points: ChartPoint[]; tone?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const reduce = useReducedMotion();
  if (!points.length) return null;
  const w = 120;
  const h = 34;
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const step = w / Math.max(1, points.length - 1);
  const y = (v: number) => h - 3 - (Math.max(0, v) / max) * (h - 8);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const show = inView || reduce;
  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden="true">
      <motion.path
        d={area}
        fill={tone}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: show ? 0.14 : 0 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 0.35, ease: "easeOut" }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={tone}
        strokeWidth="1.8"
        strokeLinecap="round"
        pathLength={1}
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.95, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  points,
  tone,
  rawValue,
  format,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  points?: ChartPoint[];
  tone?: string;
  rawValue?: number;
  format?: (n: number) => string;
  index?: number;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4"
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold mesh-eyebrow text-[var(--text-muted)]">
        <Icon size={12} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold leading-none text-[var(--text-primary)]">
        {rawValue !== undefined && format ? <AnimatedNumber value={value} target={rawValue} format={format} /> : value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{sub}</p>}
      {points && points.length > 1 && (
        <div className="mt-2">
          <Sparkline points={points} tone={tone} />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub, action }: { icon: LucideIcon; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <Icon size={16} className="text-[var(--accent)]" aria-hidden="true" />
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** One platform, every number it reports — as a scannable row. */
function PlatformRow({ account, index }: { account: AnalyticsDashboardData["platformComparison"][number]; index?: number }) {
  const tone = toneFor(account.platform);
  const cells: Array<[string, string]> = [
    ["Followers", compact(account.followerCount)],
    ["Posts", compact(account.postCount)],
    ["Views", compact(account.totalViews)],
    ["Likes", compact(account.totalLikes)],
    ["Comments", compact(account.totalComments)],
    ["Shares", compact(account.totalShares)],
    ["Watch", duration(account.watchTimeSeconds)],
    ["Eng. rate", pct(account.engagementRate)],
  ];
  return (
    <div
      className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4"
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone }} />
        <p className="text-sm font-semibold text-[var(--text-primary)]">{labelFor(account.platform)}</p>
        {account.platformUsername && <p className="text-xs text-[var(--text-muted)]">@{account.platformUsername}</p>}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            account.syncStatus === "error"
              ? "bg-red-500/15 text-red-300"
              : account.isActive
                ? "bg-emerald-500/12 text-emerald-300"
                : "bg-white/8 text-[var(--text-muted)]"
          }`}
        >
          {account.syncStatus === "error" ? "Sync error" : account.isActive ? "Synced" : "Paused"}
        </span>
        {account.followerGrowth !== 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${account.followerGrowth > 0 ? "bg-emerald-500/12 text-emerald-300" : "bg-red-500/12 text-red-300"}`}>
            {account.followerGrowth > 0 ? "+" : ""}
            {compact(account.followerGrowth)} this month
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 min-[400px]:grid-cols-4 sm:grid-cols-8">
        {cells.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="truncate text-[10px] font-semibold mesh-eyebrow text-[var(--text-muted)]">{label}</p>
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopContentRow({ post, rank }: { post: AnalyticsDashboardData["bestContent"][number]; rank: number }) {
  const tone = toneFor(post.platform);
  const inner = (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 transition hover:border-[var(--accent)]/40">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${rank === 1 ? "bg-gradient-to-br from-amber-300 to-amber-500 text-white" : "bg-[var(--bg-primary)]/70 text-[var(--text-secondary)]"}`}>
        {rank}
      </span>
      {post.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-primary)]/70">
          <FileText size={16} className="text-[var(--text-muted)]" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{post.title || "Untitled"}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
          {labelFor(post.platform)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11px] text-[var(--text-secondary)]">
        {post.views > 0 && <span className="inline-flex items-center gap-1"><Eye size={12} /> {compact(post.views)}</span>}
        <span className="inline-flex items-center gap-1"><Heart size={12} className="text-[var(--accent)]" /> {compact(post.likes)}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {compact(post.comments)}</span>
      </div>
    </div>
  );
  // min-w-0 on the grid item: without it the row's automatic minimum size is
  // the untruncated title, so the whole column blew past the viewport.
  return post.href ? (
    post.href.startsWith("/") ? (
      <Link href={post.href} className="min-w-0">
        {inner}
      </Link>
    ) : (
      <a href={post.href} target="_blank" rel="noreferrer" className="min-w-0">
        {inner}
      </a>
    )
  ) : (
    inner
  );
}

function TrendCard({ title, points, tone, index }: { title: string; points: ChartPoint[]; tone: string; index?: number }) {
  const total = points.reduce((t, p) => t + p.value, 0);
  return (
    <div
      className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4"
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{title}</p>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{compact(total)}</p>
      </div>
      <div className="mt-2">
        <Sparkline points={points} tone={tone} />
      </div>
    </div>
  );
}

/** The single strongest platform by composite score — the headline of the
 * scorecards. Not a second leaderboard: one champion plus the blended rate. */
function StandoutPlatform({ best, avgRate }: { best: AnalyticsDashboardData["creator"]["bestPlatform"]; avgRate: number }) {
  if (!best) return null;
  const tone = toneFor(best.platform);
  const cells: Array<[string, string]> = [
    ["Followers", compact(best.followerCount)],
    ["Views", compact(best.totalViews)],
    ["Eng. rate", pct(best.engagementRate)],
    ["Growth", `${best.followerGrowth >= 0 ? "+" : ""}${compact(best.followerGrowth)}`],
  ];
  return (
    <div
      className="animate-mesh-rise mb-3 rounded-2xl border border-[var(--accent)]/30 p-4"
      style={{ backgroundImage: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent)" }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="animate-mesh-pop flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${tone} 18%, transparent)` }}>
          <Crown size={16} style={{ color: tone }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold mesh-eyebrow text-[var(--text-muted)]">Your strongest platform</p>
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />
            {labelFor(best.platform)}
            {best.platformUsername && <span className="text-xs font-normal text-[var(--text-muted)]">@{best.platformUsername}</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 min-[420px]:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="truncate text-[10px] font-semibold mesh-eyebrow text-[var(--text-muted)]">{label}</p>
            <p className="truncate text-base font-semibold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-primary)]">{pct(avgRate)}</span> overall engagement across every platform.
      </p>
    </div>
  );
}

/** A compact, muted footprint tile — the viewer's own inward mesh.me numbers,
 * visually distinct from the bright outward reach cards. */
function FootprintTile({ icon: Icon, label, value, index }: { icon: LucideIcon; label: string; value: number; index: number }) {
  return (
    <div
      className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/55 p-3"
      style={{ ["--i" as string]: index } as CSSProperties}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold mesh-eyebrow text-[var(--text-muted)]">
        <Icon size={12} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 text-lg font-semibold leading-none text-[var(--text-primary)]">
        <AnimatedNumber value={compact(value)} target={value} format={compact} />
      </p>
    </div>
  );
}

const ACTIVITY_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  Post: { icon: FileText, tone: "#2f7cff" },
  Synced: { icon: PlugZap, tone: "#a78bfa" },
  Comment: { icon: MessageCircle, tone: "#34e4ea" },
  Reaction: { icon: Heart, tone: "#f43f5e" },
  Follower: { icon: Users, tone: "#34d399" },
  Sync: { icon: RefreshCw, tone: "#94a3b8" },
};

function ActivityRow({ item }: { item: AnalyticsDashboardData["recentActivity"][number] }) {
  const style = ACTIVITY_STYLE[item.type] ?? { icon: Activity, tone: "#94a3b8" };
  const Icon = style.icon;
  const inner = (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--bg-secondary)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${style.tone} 16%, transparent)` }}>
        <Icon size={13} style={{ color: style.tone }} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">{item.detail}</p>
      </div>
      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(item.timestamp)}</span>
    </div>
  );
  if (!item.href) return inner;
  return item.href.startsWith("/") ? (
    <Link href={item.href}>{inner}</Link>
  ) : (
    <a href={item.href} target="_blank" rel="noreferrer">{inner}</a>
  );
}

const VISIBILITY_TONES: Array<[keyof AnalyticsDashboardData["privacy"]["visibilityBreakdown"], string, string]> = [
  ["public", "Public", "#34d399"],
  ["friends", "Friends", "#2f7cff"],
  ["unlisted", "Unlisted", "#a78bfa"],
  ["private", "Private", "#f59e0b"],
  ["hidden", "Hidden", "#94a3b8"],
  ["other", "Other", "#64748b"],
];

function VisibilityBar({ breakdown }: { breakdown: AnalyticsDashboardData["privacy"]["visibilityBreakdown"] }) {
  const total = VISIBILITY_TONES.reduce((sum, [key]) => sum + breakdown[key], 0);
  if (total === 0) {
    return <p className="text-xs text-[var(--text-muted)]">Publish content to see where it&apos;s visible.</p>;
  }
  const parts = VISIBILITY_TONES.filter(([key]) => breakdown[key] > 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]/60">
        {parts.map(([key, , tone]) => (
          <span key={key} style={{ width: `${(breakdown[key] / total) * 100}%`, backgroundColor: tone }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map(([key, label, tone]) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />
            {label} <span className="font-semibold text-[var(--text-primary)]">{breakdown[key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CheckRow({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      {passed ? (
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <XCircle size={15} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
        {detail && <p className="text-[11px] leading-snug text-[var(--text-muted)]">{detail}</p>}
      </div>
    </div>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        ok
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-muted)]"
      }`}
    >
      {ok ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
      {label}
    </span>
  );
}

export function AnalyticsDashboard({ data, embedded = false }: { data: AnalyticsDashboardData; embedded?: boolean }) {
  // Folded into the profile as a tab (`embedded`) or shown as its own page.
  // Embedded drops the page shell (outer <main>, max-width, page padding) so it
  // fills the profile's own column, and demotes the heading so the profile's
  // name stays the page's single <h1>.
  const Container = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  return (
    // @container so grids track this column's width, not the viewport — the
    // dashboard now renders inside the (narrower) profile column as well as the
    // full-width standalone route.
    <Container className={embedded ? "@container w-full" : "@container mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"}>
      {/* Header — quiet, product-like */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading className="text-2xl font-semibold text-[var(--text-primary)]">Analytics</Heading>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Every platform you&apos;ve connected, measured in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <LockKeyhole size={13} aria-hidden="true" />
            Only you can see this
          </span>
          <Link
            href="/connected-accounts"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <PlugZap size={13} aria-hidden="true" />
            Connect platforms
          </Link>
        </div>
      </div>

      {/* The numbers that matter, with their 14-day pulse */}
      <section className="mesh-cascade mt-5 grid grid-cols-1 gap-3 @sm:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-6" aria-label="Overview">
        <Stat index={0} icon={Users} label="Audience" value={compact(data.overview.totalFollowers)} rawValue={data.overview.totalFollowers} format={compact} sub={`${data.overview.connectedAccounts} platforms connected`} points={data.charts.followerGrowth} tone="#34d399" />
        <Stat index={1} icon={Eye} label="Views" value={compact(data.overview.totalViews)} rawValue={data.overview.totalViews} format={compact} sub="across synced content" />
        <Stat index={2} icon={Heart} label="Engagement" value={compact(data.overview.totalEngagement)} rawValue={data.overview.totalEngagement} format={compact} sub="likes · comments · shares" points={data.charts.engagement} tone="#2f7cff" />
        <Stat index={3} icon={Gauge} label="Eng. rate" value={pct(data.overview.engagementRate)} rawValue={data.overview.engagementRate} format={pct} sub="of your audience responds" />
        <Stat index={4} icon={Clock3} label="Watch time" value={duration(data.overview.watchTimeSeconds)} rawValue={data.overview.watchTimeSeconds} format={duration} sub="synced video content" />
        <Stat index={5} icon={FileText} label="Content" value={compact(data.overview.totalContent)} rawValue={data.overview.totalContent} format={compact} sub={`${fmt(data.overview.nativePosts)} on mesh.me`} points={data.charts.content} tone="#a78bfa" />
      </section>

      {/* The reason this page exists: everything side by side */}
      <div className="mt-5">
        <CrossPlatformCommand data={data} />
      </div>

      {/* Every platform, every stat */}
      <section className="mt-8" aria-label="Platform scorecards">
        <SectionTitle
          icon={BarChart3}
          title="Platform scorecards"
          sub="Every number each platform reports, one row per account."
        />
        <StandoutPlatform best={data.creator.bestPlatform} avgRate={data.creator.averageEngagementRate} />
        {data.platformComparison.length > 0 ? (
          <div className="mesh-cascade grid gap-3">
            {data.platformComparison.map((account, i) => (
              <PlatformRow key={account.id} account={account} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">No platforms connected yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
              Connect YouTube, Instagram, X, Reddit and more — their stats appear here automatically and join the side-by-side view above.
            </p>
          </div>
        )}
      </section>

      {/* Best content across everything */}
      <section className="mt-8" aria-label="Top content">
        <SectionTitle
          icon={Trophy}
          title="Top content, all platforms"
          sub="Your best-performing posts ranked across every world you publish in."
        />
        {data.bestContent.length > 0 ? (
          <div className="grid gap-2">
            {data.bestContent.slice(0, 8).map((post, index) => (
              <TopContentRow key={`${post.platform}-${post.id}`} post={post} rank={index + 1} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-5 py-6 text-center text-xs text-[var(--text-secondary)]">
            Publish on mesh.me or sync a platform to rank your top content here.
          </p>
        )}
      </section>

      {/* Trends */}
      <section className="mt-8" aria-label="Trends">
        <SectionTitle icon={TrendingUp} title="14-day trends" />
        <div className="mesh-cascade grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TrendCard index={0} title="Engagement received" points={data.charts.engagement} tone="#2f7cff" />
          <TrendCard index={1} title="Audience growth" points={data.charts.followerGrowth} tone="#34d399" />
          <TrendCard index={2} title="Content published" points={data.charts.content} tone="#a78bfa" />
          <TrendCard index={3} title="Your activity" points={data.charts.activity} tone="#f59e0b" />
        </div>
      </section>

      {/* You on mesh.me — the inward footprint the page never used to show. */}
      <section className="mt-8" aria-label="Your mesh.me footprint">
        <SectionTitle
          icon={Fingerprint}
          title="You on mesh.me"
          sub="Your own footprint here — visible only to you."
        />
        <div className="mesh-cascade grid grid-cols-2 gap-2.5 @sm:grid-cols-3 @3xl:grid-cols-5">
          <FootprintTile index={0} icon={FileText} label="Posts · 30d" value={data.personal.postsThisWindow} />
          <FootprintTile index={1} icon={Users} label="Followers" value={data.personal.followers} />
          <FootprintTile index={2} icon={UserPlus} label="Following" value={data.personal.following} />
          <FootprintTile index={3} icon={UsersRound} label="Communities" value={data.personal.communities} />
          <FootprintTile index={4} icon={MessageCircle} label="Comments" value={data.personal.commentsWritten} />
          <FootprintTile index={5} icon={Heart} label="Reactions" value={data.personal.reactionsMade} />
          <FootprintTile index={6} icon={Bookmark} label="Saved" value={data.personal.savedPosts} />
          <FootprintTile index={7} icon={Send} label="Messages" value={data.personal.messagesSent} />
          <FootprintTile index={8} icon={Bell} label="Notifications" value={data.personal.notifications} />
        </div>

        {data.recentActivity.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 p-3 md:p-4">
            <p className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">
              <Activity size={13} aria-hidden="true" />
              Recent activity
            </p>
            <div className="divide-y divide-[var(--border-primary)]/60">
              {data.recentActivity.slice(0, 10).map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Data controls, tucked at the end where they belong */}
      <section className="mt-10 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4 md:p-5" aria-label="Data and privacy">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <ShieldCheck size={15} className="text-emerald-400" aria-hidden="true" />
            Data &amp; privacy
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">
            Privacy health <span className="font-semibold text-[var(--text-primary)]">{data.privacy.score}%</span> · {data.privacy.sessions} active sessions
          </span>
        </div>

        {/* Account status — verification, second factor, and plan at a glance. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill label="Email verified" ok={data.user.emailVerified} />
          <StatusPill label="Phone verified" ok={data.user.phoneVerified} />
          <StatusPill
            label={data.privacy.twoFactorMethods > 0 ? `${data.privacy.twoFactorMethods} 2FA method${data.privacy.twoFactorMethods > 1 ? "s" : ""}` : "2FA off"}
            ok={data.privacy.twoFactorMethods > 0}
          />
          <StatusPill label={data.user.isMeshPro ? "Mesh Pro" : "Free plan"} ok={data.user.isMeshPro} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            {effectiveProfileVisibility(data.user.isPublic, data.user.meshVisibility) === "public"
              ? "Public profile"
              : effectiveProfileVisibility(data.user.isPublic, data.user.meshVisibility) === "friends"
                ? "Friends only"
                : "Private profile"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            {data.user.showInDiscovery ? "In discovery" : "Hidden from discovery"}
          </span>
        </div>

        {/* Security checklist + where your content actually lives. */}
        <div className="mt-4 grid gap-4 @3xl:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">
              <ShieldCheck size={13} className="text-emerald-400" aria-hidden="true" />
              Security checklist
            </p>
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 px-3 py-2">
              {data.privacy.checks.map((check) => (
                <CheckRow key={check.label} label={check.label} passed={check.passed} detail={check.detail} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">
              <Eye size={13} aria-hidden="true" />
              Where your content is visible
            </p>
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 p-4">
              <VisibilityBar breakdown={data.privacy.visibilityBreakdown} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 @3xl:grid-cols-2">
          <PrivacyPermissionsManager accounts={data.accounts} />
          <AnalyticsControls />
        </div>
      </section>
    </Container>
  );
}
