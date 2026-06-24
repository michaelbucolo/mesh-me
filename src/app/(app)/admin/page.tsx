import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  LockKeyhole,
  MessageSquareWarning,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { AdminActions } from "./admin-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { getAdminDashboard } from "@/lib/admin-dashboard";
import { cn, formatCount, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin",
  description: "Role-gated Mesh.me admin console for users, moderation, communities, security, analytics, and launch readiness.",
};

const statusStyles = {
  pass: {
    icon: CheckCircle2,
    className: "border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] text-[var(--ds-success)]",
    label: "Ready",
  },
  warn: {
    icon: AlertTriangle,
    className: "border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]",
    label: "Watch",
  },
  fail: {
    icon: XCircle,
    className: "border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
    label: "Fix",
  },
};

const severityStyles = {
  low: "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--text-secondary)]",
  medium: "border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]",
  high: "border-[var(--ds-danger-border)] bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
};

type AdminDashboardData = NonNullable<Awaited<ReturnType<typeof getAdminDashboard>>>;
type LaunchCheck = AdminDashboardData["launchChecks"][number];

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <section className="mesh-surface rounded-[24px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{label}</p>
        <Icon className="h-5 w-5 text-[var(--accent)]" />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-[0] text-[var(--text-primary)]">{formatCount(value)}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
    </section>
  );
}

function LaunchCheckCard({
  check,
}: {
  check: LaunchCheck;
}) {
  const style = statusStyles[check.status];
  const Icon = style.icon;

  return (
    <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-2xl border", style.className)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--text-primary)]">{check.label}</p>
            <Badge variant={check.status === "pass" ? "success" : check.status === "warn" ? "warning" : "danger"}>
              {style.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{check.description}</p>
        </div>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const data = await getAdminDashboard();
  if (!data) redirect("/feed");

  const reportResolutionRate =
    data.counts.totalReports > 0
      ? Math.round(((data.counts.totalReports - data.counts.pendingReports) / data.counts.totalReports) * 100)
      : 100;

  return (
    <main data-meshi-zone="admin" className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6">
      <header className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-subtle)]">
              <MeshiLogo size={38} color="blue" mood="happy" />
            </div>
            <div>
              <Badge variant="accent" className="mb-2">Role-gated admin</Badge>
              <h1 className="text-3xl font-bold tracking-[0] text-[var(--text-primary)]">Admin Panel</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                Manage users, reports, communities, security alerts, analytics, and public launch readiness from one place.
              </p>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Signed in as {data.admin.displayName} (@{data.admin.username})
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings">
                Security settings
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/communities">
                Communities
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={data.counts.users} detail={`+${data.counts.recentSignups} this week`} icon={Users} />
        <MetricCard label="Posts" value={data.counts.posts} detail={`+${data.counts.recentPosts} this week`} icon={BarChart3} />
        <MetricCard label="Communities" value={data.counts.communities} detail={`${data.counts.publicCommunities} public, ${data.counts.privateCommunities} private`} icon={RadioTower} />
        <MetricCard label="Pending reports" value={data.counts.pendingReports} detail={`${reportResolutionRate}% resolved all time`} icon={Flag} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <section id="moderation" className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-[0] text-[var(--text-primary)]">
                  <MessageSquareWarning className="h-5 w-5 text-[var(--accent)]" />
                  Moderation queue
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">Review reports across users, posts, comments, and communities.</p>
              </div>
              <Badge variant={data.counts.pendingReports ? "warning" : "success"}>
                {data.counts.pendingReports ? `${data.counts.pendingReports} pending` : "Clear"}
              </Badge>
            </div>

            {data.recentReports.length ? (
              <div className="grid gap-3">
                {data.recentReports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="warning">Report</Badge>
                          <span className="text-xs text-[var(--text-tertiary)]">{formatRelativeTime(report.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{report.reason}</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          Reported by @{report.reporter.username}
                          {report.reportedUser ? ` about @${report.reportedUser.username}` : ""}
                          {report.reportedCommunity ? ` in ${report.reportedCommunity.name}` : ""}
                        </p>
                        {report.reportedPost ? (
                          <div className="mt-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--bg-primary)] p-3">
                            <p className="line-clamp-3 text-xs leading-5 text-[var(--text-secondary)]">{report.reportedPost.content}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button asChild variant="secondary" size="sm">
                                <Link href={`/feed/${report.reportedPost.id}`}>Open post</Link>
                              </Button>
                              <AdminActions type="post" id={report.reportedPost.id} />
                            </div>
                          </div>
                        ) : null}
                        {report.reportedComment ? (
                          <div className="mt-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--bg-primary)] p-3">
                            <p className="line-clamp-3 text-xs leading-5 text-[var(--text-secondary)]">Comment: {report.reportedComment.content}</p>
                          </div>
                        ) : null}
                        {report.reportedCommunity ? (
                          <div className="mt-3 rounded-2xl border border-[var(--ds-border)] bg-[var(--bg-primary)] p-3">
                            <p className="text-xs font-bold text-[var(--text-primary)]">{report.reportedCommunity.name}</p>
                            <Button asChild variant="secondary" size="sm" className="mt-2">
                              <Link href={`/communities/${report.reportedCommunity.slug}`}>Open community</Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <AdminActions type="report" id={report.id} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--ds-border)] p-8 text-center">
                <ShieldCheck className="mx-auto h-9 w-9 text-[var(--ds-success)]" />
                <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">No pending reports</p>
                <p className="text-xs text-[var(--text-secondary)]">The moderation queue is clear.</p>
              </div>
            )}
          </section>

          <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-[0] text-[var(--text-primary)]">
                  <Users className="h-5 w-5 text-[var(--accent)]" />
                  User management
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">Suspend abusive users, inspect account activity, and confirm admin status.</p>
              </div>
              <Badge variant="secondary">{data.recentUsers.length} recent users</Badge>
            </div>
            <div className="grid gap-2">
              {data.recentUsers.map((user) => (
                <article key={user.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/profile/${user.username}`} className="text-sm font-bold text-[var(--text-primary)] hover:underline">
                          {user.displayName}
                        </Link>
                        <span className="text-xs text-[var(--text-tertiary)]">@{user.username}</span>
                        {user.isAdmin ? <Badge variant="accent">Admin</Badge> : null}
                        {user.isSuspended ? <Badge variant="danger">Suspended</Badge> : null}
                        {user.isVerified ? <Badge variant="success">Verified</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                        {user._count.posts} posts · {user._count.followers} followers · {user._count.communityMemberships} communities · joined {formatRelativeTime(user.createdAt)}
                      </p>
                    </div>
                    <AdminActions type="user" id={user.id} isSuspended={user.isSuspended} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-[0] text-[var(--text-primary)]">
                <RadioTower className="h-5 w-5 text-[var(--accent)]" />
                Community moderation
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">Review public/private status, community reports, admins, and activity.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.communities.map((community) => (
                <article key={community.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/communities/${community.slug}`} className="truncate text-base font-bold text-[var(--text-primary)] hover:underline">
                          {community.name}
                        </Link>
                        <Badge variant={community.isPublic ? "outline" : "warning"}>{community.isPublic ? "Public" : "Private"}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text-secondary)]">
                        {community.description || "No description yet."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-tertiary)]">
                    <span>{community._count.members} members</span>
                    <span>{community._count.posts} posts</span>
                    <span>{community._count.reports} reports</span>
                    <span>Updated {formatRelativeTime(community.updatedAt)}</span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--text-secondary)]">
                    Admins: {community.members.length ? community.members.map((member) => member.user.displayName || member.user.username).join(", ") : "No listed admin"}
                  </p>
                  <div className="mt-4">
                    <AdminActions type="community" id={community.id} isPublic={community.isPublic} reportCount={community._count.reports} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section id="launch" className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
              <Activity className="h-5 w-5 text-[var(--accent)]" />
              Launch readiness
            </h2>
            <div className="mt-4 grid gap-3">
              {data.launchChecks.map((check) => (
                <LaunchCheckCard key={check.label} check={check} />
              ))}
            </div>
          </section>

          <section id="security" className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
              <ShieldAlert className="h-5 w-5 text-[var(--accent)]" />
              Security alerts
            </h2>
            <div className="mt-4 grid gap-3">
              {data.securityAlerts.length ? (
                data.securityAlerts.map((alert) => (
                  <Link key={`${alert.title}-${alert.href}`} href={alert.href} className={cn("rounded-2xl border p-3 transition hover:-translate-y-0.5", severityStyles[alert.severity])}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-bold">{alert.title}</p>
                        <p className="mt-1 text-xs leading-5 opacity-90">{alert.description}</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] p-4 text-sm text-[var(--ds-success)]">
                  No active security alerts.
                </div>
              )}
            </div>
          </section>

          <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
              <BarChart3 className="h-5 w-5 text-[var(--accent)]" />
              Platform analytics
            </h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Active sessions</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.counts.activeSessions)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Connected accounts</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.counts.connectedAccounts)}</p>
                <p className="text-xs text-[var(--text-secondary)]">{data.counts.erroredConnectedAccounts} need sync attention</p>
              </div>
              <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Verified users</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{formatCount(data.counts.verifiedUsers)}</p>
              </div>
            </div>
          </section>

          <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
              <Clock className="h-5 w-5 text-[var(--accent)]" />
              Admin activity
            </h2>
            <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {data.adminLogs.length ? (
                data.adminLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{log.action.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{log.details || "No details"}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                      {log.admin.displayName || log.admin.username} · {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-[var(--ds-border)] p-4 text-sm text-[var(--text-secondary)]">
                  No admin actions yet.
                </p>
              )}
            </div>
          </section>

          <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
              <LockKeyhole className="h-5 w-5 text-[var(--accent)]" />
              Security actions
            </h2>
            <div className="mt-4 grid gap-2">
              {data.recentSecurityLogs.length ? (
                data.recentSecurityLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-3">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{log.action.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{log.details || "No details"}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{formatRelativeTime(log.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">No security actions in the last 30 days.</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
