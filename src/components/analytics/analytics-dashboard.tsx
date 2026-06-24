import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Crown,
  Database,
  Eye,
  Heart,
  LineChart,
  LockKeyhole,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { AnalyticsControls } from "@/components/analytics/analytics-controls";
import { PrivacyPermissionsManager } from "@/components/analytics/privacy-permissions-manager";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import type { AnalyticsDashboardData } from "@/lib/analytics-dashboard";

type ChartPoint = AnalyticsDashboardData["charts"]["engagement"][number];

type AnalyticsDashboardProps = {
  data: AnalyticsDashboardData;
};

const numberFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(Math.round(value || 0));
}

function formatCompact(value: number | null | undefined) {
  return compactFormatter.format(Math.round(value || 0));
}

function formatPercent(value: number | null | undefined) {
  const next = Number(value || 0);
  return `${next >= 10 ? next.toFixed(0) : next.toFixed(1)}%`;
}

function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${formatNumber(hours)}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.round(total)}s`;
}

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function SmartLink({ href, children, className }: { href: string | null | undefined; children: ReactNode; className: string }) {
  if (!href) return <span className={className}>{children}</span>;
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const creatorMomentum = data.creator.bestPlatform
    ? `${data.creator.bestPlatform.platform} is leading by total engagement.`
    : "Connect a platform to unlock creator comparisons.";
  const topContent = data.bestContent[0];

  return (
    <main className="simple-page grid gap-5">
      <header className="mesh-surface mesh-pop-in rounded-lg p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MeshiBrandLockup size={36} label="Analytics" subtitle="Private performance" useUserMeshi />
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
            <LockKeyhole size={14} aria-hidden="true" />
            Only you can see this
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div>
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">Your whole digital footprint, measured clearly.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              Personal activity, creator performance, platform comparisons, and privacy health are combined into one private dashboard.
            </p>
          </div>
          <PrivacyScorePanel score={data.privacy.score} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Analytics overview">
        <StatCard label="Total reach" value={formatCompact(data.overview.totalViews)} detail={`${formatNumber(data.overview.totalContent)} pieces of content`} icon={Eye} />
        <StatCard label="Followers" value={formatCompact(data.overview.totalFollowers)} detail={`${formatNumber(data.overview.connectedAccounts)} connected accounts`} icon={Users} />
        <StatCard label="Engagement" value={formatPercent(data.overview.engagementRate)} detail={`${formatNumber(data.overview.totalEngagement)} total actions`} icon={Heart} />
        <StatCard label="Watch time" value={formatDuration(data.overview.watchTimeSeconds)} detail="Across synced video content" icon={PlayCircle} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <section className="grid gap-5 lg:grid-cols-2">
            <Panel title="Personal analytics" eyebrow="Your usage" actionHref="/profile" actionLabel="Profile">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniMetric label="Mesh posts" value={formatNumber(data.overview.nativePosts)} />
                <MiniMetric label="Comments written" value={formatNumber(data.personal.commentsWritten)} />
                <MiniMetric label="Reactions made" value={formatNumber(data.personal.reactionsMade)} />
                <MiniMetric label="Saved posts" value={formatNumber(data.personal.savedPosts)} />
                <MiniMetric label="Messages sent" value={formatNumber(data.personal.messagesSent)} />
                <MiniMetric label="Communities" value={formatNumber(data.personal.communities)} />
              </div>
            </Panel>

            <Panel title="Creator analytics" eyebrow="Audience and content" actionHref="/meshpro" actionLabel="Mesh Pro">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniMetric label="Creator views" value={formatCompact(data.creator.totalViews)} />
                <MiniMetric label="Creator followers" value={formatCompact(data.creator.totalFollowers)} />
                <MiniMetric label="Likes" value={formatCompact(data.creator.totalLikes)} />
                <MiniMetric label="Comments" value={formatCompact(data.creator.totalComments)} />
                <MiniMetric label="Shares" value={formatCompact(data.creator.totalShares)} />
                <MiniMetric label="Avg. engagement" value={formatPercent(data.creator.averageEngagementRate)} />
              </div>
            </Panel>
          </section>

          <PremiumAnalyticsPanel data={data} />

          <section className="mesh-surface rounded-lg p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Charts</p>
                <h2 className="mt-1 text-xl font-bold">Engagement, growth, and activity</h2>
              </div>
              <span className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
                Last 14 days
              </span>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Engagement" subtitle="Likes, comments, shares, and reactions" icon={LineChart}>
                <BarChart points={data.charts.engagement} tone="accent" />
              </ChartCard>
              <ChartCard title="Follower growth" subtitle="Native follows plus platform net growth" icon={TrendingUp}>
                <BarChart points={data.charts.followerGrowth} tone="emerald" allowNegative />
              </ChartCard>
              <ChartCard title="Content output" subtitle="Native and synced posts entering your Mesh" icon={BarChart3}>
                <BarChart points={data.charts.content} tone="blue" />
              </ChartCard>
              <ChartCard title="Personal activity" subtitle="Messages, comments, saves, posts, and follows" icon={Activity}>
                <BarChart points={data.charts.activity} tone="violet" />
              </ChartCard>
            </div>
          </section>

          <section className="mesh-surface rounded-lg p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Platform comparison</p>
                <h2 className="mt-1 text-xl font-bold">Every connected app, one scorecard</h2>
              </div>
              <Link href="/connected-accounts" className="mesh-action mesh-action-secondary px-3 text-sm">
                Manage accounts
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {data.platformComparison.length > 0 ? (
                data.platformComparison.map((account) => <PlatformComparisonCard key={account.id} account={account} />)
              ) : (
                <EmptyState
                  title="No connected platform analytics yet."
                  body="Connect YouTube, Reddit, GitHub, Twitch, Discord, or another supported platform to compare performance here."
                  href="/connected-accounts"
                  label="Connect account"
                />
              )}
            </div>
          </section>

          <section className="mesh-surface rounded-lg p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Best content</p>
                <h2 className="mt-1 text-xl font-bold">Top-performing posts</h2>
              </div>
              <span className="text-xs font-bold text-[var(--text-muted)]">{topContent ? `Best: ${topContent.source}` : "Waiting for data"}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {data.bestContent.length > 0 ? (
                data.bestContent.map((post) => <TopContentCard key={`${post.platform}-${post.id}`} post={post} />)
              ) : (
                <EmptyState
                  title="No content has enough activity yet."
                  body="Publish on Mesh.me or sync connected accounts to see your top posts ranked by engagement."
                  href="/feed"
                  label="Go to feed"
                />
              )}
            </div>
          </section>

          <section className="mesh-surface rounded-lg p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Privacy permissions</p>
                <h2 className="mt-1 text-xl font-bold">App access and data inventory</h2>
              </div>
              <Link href="/privacy-controls" className="mesh-action mesh-action-secondary px-3 text-sm">
                Privacy controls
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4">
              <PrivacyPermissionsManager accounts={data.accounts} />
            </div>
          </section>
        </div>

        <aside className="grid h-fit gap-4">
          <InsightCard
            icon={Sparkles}
            title="Meshi's read"
            body={`${creatorMomentum} Your privacy health is ${data.privacy.score}%, and ${formatNumber(data.overview.importedPosts)} imported posts are currently represented in your Mesh.`}
            status={data.user.isMeshPro ? "Mesh Pro active" : "Mesh Pro free"}
          />

          <PrivacyHealthCard data={data} />

          <div className="mesh-surface rounded-lg p-4">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Database size={17} aria-hidden="true" />
              Data controls
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Export everything or delete imported platform data without removing your Mesh.me account.
            </p>
            <div className="mt-4">
              <AnalyticsControls />
            </div>
          </div>

          <ActivityHistory items={data.recentActivity} />
        </aside>
      </section>
    </main>
  );
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="mesh-surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
        <Icon className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function Panel({ title, eyebrow, actionHref, actionLabel, children }: {
  title: string;
  eyebrow: string;
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="mesh-surface rounded-lg p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold">{title}</h2>
        </div>
        <Link href={actionHref} className="text-xs font-bold text-[var(--accent)]">
          {actionLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function PremiumAnalyticsPanel({ data }: { data: AnalyticsDashboardData }) {
  const proMetrics = [
    {
      label: "Best platform",
      value: data.creator.bestPlatform?.platform ?? "Connect more",
      detail: data.creator.bestPlatform ? `${formatCompact(data.creator.bestPlatform.totalViews)} views` : "Needs synced accounts",
    },
    {
      label: "Audience quality",
      value: formatPercent(data.creator.averageEngagementRate),
      detail: "Cross-platform engagement rate",
    },
    {
      label: "Content velocity",
      value: formatNumber(data.personal.postsThisWindow),
      detail: "Native posts in 30-day window",
    },
    {
      label: "Report depth",
      value: data.platformComparison.length > 1 ? `${data.platformComparison.length} sources` : "1 source",
      detail: "Pro exports compare every platform",
    },
  ];

  return (
    <section className="mesh-surface rounded-lg p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <Crown size={15} aria-hidden="true" />
            Mesh Pro
          </p>
          <h2 className="mt-1 text-xl font-bold">Premium analytics</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {data.user.isMeshPro
              ? "Deeper creator and platform signals are active."
              : "Upgrade to unlock advanced comparisons, exports, and longer-history views."}
          </p>
        </div>
        <Link href="/meshpro" className="mesh-action mesh-action-secondary px-3 text-sm">
          {data.user.isMeshPro ? "Manage Pro" : "Unlock Pro"}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {proMetrics.map((metric) => (
          <div key={metric.label} className={`rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-3 ${data.user.isMeshPro ? "" : "opacity-70"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{metric.label}</p>
              {!data.user.isMeshPro && <LockKeyhole size={13} className="text-[var(--text-muted)]" aria-hidden="true" />}
            </div>
            <p className="mt-2 truncate text-lg font-bold">{data.user.isMeshPro ? metric.value : "Locked"}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{metric.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <Icon className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BarChart({ points, tone, allowNegative = false }: { points: ChartPoint[]; tone: "accent" | "emerald" | "blue" | "violet"; allowNegative?: boolean }) {
  const absoluteMax = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  const colorClass = {
    accent: "bg-[var(--accent)]",
    emerald: "bg-emerald-400",
    blue: "bg-sky-400",
    violet: "bg-violet-400",
  }[tone];

  return (
    <div className="h-40" role="img" aria-label={`${points.length} day chart`}>
      <div className="grid h-32 items-end gap-1 border-b border-[var(--border-primary)]" style={{ gridTemplateColumns: `repeat(${CHART_COLUMNS}, minmax(0, 1fr))` }}>
        {points.map((point) => {
          const height = Math.max(6, Math.round((Math.abs(point.value) / absoluteMax) * 100));
          const isNegative = allowNegative && point.value < 0;
          return (
            <div key={point.key} className="flex h-full min-w-0 flex-col justify-end gap-1">
              <div className="flex h-full items-end justify-center">
                <span
                  className={`w-full max-w-5 rounded-t-sm ${isNegative ? "bg-red-400" : colorClass}`}
                  style={{ height: `${height}%`, opacity: point.value === 0 ? 0.22 : 0.95 }}
                  title={`${point.label}: ${formatNumber(point.value)}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-1 text-center text-[10px] text-[var(--text-muted)]" style={{ gridTemplateColumns: `repeat(${CHART_COLUMNS}, minmax(0, 1fr))` }}>
        {points.map((point, index) => (
          <span key={point.key} className={index % 3 === 0 || index === points.length - 1 ? "block truncate" : "sr-only"}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const CHART_COLUMNS = 14;

function PlatformComparisonCard({ account }: { account: AnalyticsDashboardData["platformComparison"][number] }) {
  const health = account.syncStatus === "error" || account.syncError ? "Needs attention" : account.isActive ? "Active" : "Paused";
  return (
    <article className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold capitalize">{account.platform}</h3>
          <p className="text-xs text-[var(--text-muted)]">{account.platformUsername || "Connected account"}</p>
        </div>
        <span className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]">
          {health}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MiniMetric label="Posts" value={formatNumber(account.postCount)} />
        <MiniMetric label="Followers" value={formatCompact(account.followerCount)} />
        <MiniMetric label="Views" value={formatCompact(account.totalViews)} />
        <MiniMetric label="Engagement" value={formatPercent(account.engagementRate)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
        <span>{formatNumber(account.totalLikes)} likes</span>
        <span>{formatNumber(account.totalComments)} comments</span>
        <span>{formatNumber(account.totalShares)} shares</span>
        <span>{account.followerGrowth >= 0 ? "+" : ""}{formatNumber(account.followerGrowth)} growth</span>
      </div>
    </article>
  );
}

function TopContentCard({ post }: { post: AnalyticsDashboardData["bestContent"][number] }) {
  return (
    <article className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
      <div className="grid gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
        <div
          className="aspect-square overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)]"
          style={post.thumbnailUrl ? { backgroundImage: `url(${post.thumbnailUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          aria-hidden="true"
        >
          {!post.thumbnailUrl && (
            <div className="flex h-full items-center justify-center">
              <BarChart3 className="h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{post.source}</p>
              <h3 className="mt-1 line-clamp-2 text-sm font-bold">{post.title}</h3>
            </div>
            <span className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
              {post.postType}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <TinyStat label="Views" value={formatCompact(post.views)} />
            <TinyStat label="Likes" value={formatCompact(post.likes)} />
            <TinyStat label="Comments" value={formatCompact(post.comments)} />
            <TinyStat label="Shares" value={formatCompact(post.shares)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--text-muted)]">{formatDate(post.publishedAt)} · {post.visibility}</p>
            <SmartLink href={post.href} className="text-xs font-bold text-[var(--accent)]">
              Open
            </SmartLink>
          </div>
        </div>
      </div>
    </article>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  );
}

function PrivacyScorePanel({ score }: { score: number }) {
  const ringColor = score >= 85 ? "border-emerald-400 text-emerald-200" : score >= 65 ? "border-amber-300 text-amber-100" : "border-red-300 text-red-100";
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-4">
      <div className="flex items-center gap-4">
        <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 ${ringColor}`}>
          <span className="text-xl font-bold">{score}%</span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Privacy health</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Security checks, sessions, NSFW controls, account health, and Mesh visibility.
          </p>
        </div>
      </div>
    </div>
  );
}

function PrivacyHealthCard({ data }: { data: AnalyticsDashboardData }) {
  return (
    <section className="mesh-surface rounded-lg p-4">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <ShieldCheck size={17} aria-hidden="true" />
        Privacy health score
      </h2>
      <div className="mt-3 grid gap-2">
        {data.privacy.checks.map((check) => (
          <div key={check.label} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
            <div className="flex items-start gap-2">
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-300" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-bold">{check.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{check.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MiniMetric label="Public items" value={formatNumber(data.privacy.visibilityBreakdown.public)} />
        <MiniMetric label="Private items" value={formatNumber(data.privacy.visibilityBreakdown.private + data.privacy.visibilityBreakdown.hidden)} />
        <MiniMetric label="Active sessions" value={formatNumber(data.privacy.sessions)} />
        <MiniMetric label="2FA methods" value={formatNumber(data.privacy.twoFactorMethods)} />
      </div>
      <Link href="/privacy-controls" className="mesh-action mesh-action-primary mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-3 text-sm">
        Review privacy
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}

function InsightCard({ icon: Icon, title, body, status }: { icon: LucideIcon; title: string; body: string; status: string }) {
  return (
    <section className="mesh-surface rounded-lg p-4">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Icon size={17} aria-hidden="true" />
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      <div className="mt-4 grid gap-2">
        <MiniMetric label="Plan" value={status} />
      </div>
    </section>
  );
}

function ActivityHistory({ items }: { items: AnalyticsDashboardData["recentActivity"] }) {
  return (
    <section className="mesh-surface rounded-lg p-4">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Clock3 size={17} aria-hidden="true" />
        Activity history
      </h2>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <SmartLink key={item.id} href={item.href} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 transition hover:border-[var(--accent-muted)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{item.type}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{formatDate(item.timestamp)}</span>
              </div>
            </SmartLink>
          ))
        ) : (
          <p className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 text-sm text-[var(--text-secondary)]">
            Activity appears here as you post, sync, comment, react, and gain followers.
          </p>
        )}
      </div>
    </section>
  );
}

function EmptyState({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-6 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      <Link href={href} className="mesh-action mesh-action-primary mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm">
        {label}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
