import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Clock3,
  Eye,
  FileText,
  Gauge,
  Heart,
  LockKeyhole,
  MessageCircle,
  PlugZap,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
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

/** Tiny area sparkline — trend at a glance, no axes, no chrome. */
function Sparkline({ points, tone = "#2f7cff" }: { points: ChartPoint[]; tone?: string }) {
  if (!points.length) return null;
  const w = 120;
  const h = 34;
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const step = w / Math.max(1, points.length - 1);
  const y = (v: number) => h - 3 - (Math.max(0, v) / max) * (h - 8);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={tone} opacity="0.14" />
      <path d={line} fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
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
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  points?: ChartPoint[];
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        <Icon size={12} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold leading-none text-[var(--text-primary)]">{value}</p>
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
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
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
function PlatformRow({ account }: { account: AnalyticsDashboardData["platformComparison"][number] }) {
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
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone }} />
        <p className="text-sm font-bold text-[var(--text-primary)]">{labelFor(account.platform)}</p>
        {account.platformUsername && <p className="text-xs text-[var(--text-muted)]">@{account.platformUsername}</p>}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
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
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${account.followerGrowth > 0 ? "bg-emerald-500/12 text-emerald-300" : "bg-red-500/12 text-red-300"}`}>
            {account.followerGrowth > 0 ? "+" : ""}
            {compact(account.followerGrowth)} this month
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 min-[400px]:grid-cols-4 sm:grid-cols-8">
        {cells.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopContentRow({ post, rank }: { post: AnalyticsDashboardData["bestContent"][number]; rank: number }) {
  const tone = toneFor(post.platform);
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 transition hover:border-[var(--accent)]/40">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${rank === 1 ? "bg-gradient-to-br from-amber-300 to-amber-500 text-white" : "bg-[var(--bg-primary)]/70 text-[var(--text-secondary)]"}`}>
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
  return post.href ? (
    post.href.startsWith("/") ? (
      <Link href={post.href}>{inner}</Link>
    ) : (
      <a href={post.href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    )
  ) : (
    inner
  );
}

function TrendCard({ title, points, tone }: { title: string; points: ChartPoint[]; tone: string }) {
  const total = points.reduce((t, p) => t + p.value, 0);
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{title}</p>
        <p className="text-sm font-bold text-[var(--text-primary)]">{compact(total)}</p>
      </div>
      <div className="mt-2">
        <Sparkline points={points} tone={tone} />
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ data }: { data: AnalyticsDashboardData }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* Header — quiet, product-like */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
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
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
          >
            <PlugZap size={13} aria-hidden="true" />
            Connect platforms
          </Link>
        </div>
      </div>

      {/* The numbers that matter, with their 14-day pulse */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Overview">
        <Stat icon={Users} label="Audience" value={compact(data.overview.totalFollowers)} sub={`${data.overview.connectedAccounts} platforms connected`} points={data.charts.followerGrowth} tone="#34d399" />
        <Stat icon={Eye} label="Views" value={compact(data.overview.totalViews)} sub="across synced content" />
        <Stat icon={Heart} label="Engagement" value={compact(data.overview.totalEngagement)} sub="likes · comments · shares" points={data.charts.engagement} tone="#2f7cff" />
        <Stat icon={Gauge} label="Eng. rate" value={pct(data.overview.engagementRate)} sub="of your audience responds" />
        <Stat icon={Clock3} label="Watch time" value={duration(data.overview.watchTimeSeconds)} sub="synced video content" />
        <Stat icon={FileText} label="Content" value={compact(data.overview.totalContent)} sub={`${fmt(data.overview.nativePosts)} on mesh.me`} points={data.charts.content} tone="#a78bfa" />
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
        {data.platformComparison.length > 0 ? (
          <div className="grid gap-3">
            {data.platformComparison.map((account) => (
              <PlatformRow key={account.id} account={account} />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TrendCard title="Engagement received" points={data.charts.engagement} tone="#2f7cff" />
          <TrendCard title="Audience growth" points={data.charts.followerGrowth} tone="#34d399" />
          <TrendCard title="Content published" points={data.charts.content} tone="#a78bfa" />
          <TrendCard title="Your activity" points={data.charts.activity} tone="#f59e0b" />
        </div>
      </section>

      {/* Data controls, tucked at the end where they belong */}
      <section className="mt-10 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4 md:p-5" aria-label="Data and privacy">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <ShieldCheck size={15} className="text-emerald-400" aria-hidden="true" />
            Data &amp; privacy
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">
            Privacy health <span className="font-bold text-[var(--text-primary)]">{data.privacy.score}%</span> · {data.privacy.sessions} active sessions
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PrivacyPermissionsManager accounts={data.accounts} />
          <AnalyticsControls />
        </div>
      </section>
    </main>
  );
}
