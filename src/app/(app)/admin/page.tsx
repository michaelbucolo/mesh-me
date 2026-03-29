import { getCurrentUser } from "@/lib/auth";
import { getAdminStats } from "@/lib/queries";
import { redirect } from "next/navigation";
import { Shield, Users, FileText, Flag, TrendingUp, Clock, Activity, Hash } from "lucide-react";
import { AdminActions } from "./admin-actions";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/feed");

  const stats = await getAdminStats();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin Panel</h1>
          <p className="text-xs text-zinc-500">Platform overview and moderation</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: stats.userCount, icon: Users, color: "text-blue-400", bg: "from-blue-500/10 to-blue-500/5", sub: `+${stats.recentSignups} this week` },
          { label: "Total Posts", value: stats.postCount, icon: FileText, color: "text-blue-300", bg: "from-blue-400/10 to-blue-400/5", sub: `+${stats.recentPostCount} this week` },
          { label: "Communities", value: stats.communityCount, icon: Hash, color: "text-cyan-400", bg: "from-cyan-500/10 to-cyan-500/5", sub: "active groups" },
          { label: "Pending Reports", value: stats.reportCount, icon: Flag, color: stats.reportCount > 0 ? "text-red-400" : "text-emerald-400", bg: stats.reportCount > 0 ? "from-red-500/10 to-red-500/5" : "from-emerald-500/10 to-emerald-500/5", sub: stats.reportCount > 0 ? "needs attention" : "all clear" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border border-zinc-800 bg-gradient-to-br ${stat.bg} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-400 font-medium">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-3xl font-bold text-zinc-100">{stat.value.toLocaleString()}</p>
            <p className="text-xs text-zinc-500 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick analytics row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-medium text-zinc-300">Growth (7d)</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">New users</span>
              <span className="text-sm font-medium text-zinc-200">{stats.recentSignups}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: `${Math.min(100, (stats.recentSignups / Math.max(stats.userCount, 1)) * 100 * 10)}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">New posts</span>
              <span className="text-sm font-medium text-zinc-200">{stats.recentPostCount}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-pink-500 rounded-full" style={{ width: `${Math.min(100, (stats.recentPostCount / Math.max(stats.postCount, 1)) * 100 * 10)}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-medium text-zinc-300">Platform Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Reports queue</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stats.reportCount > 5 ? "bg-red-500/10 text-red-400" : stats.reportCount > 0 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                {stats.reportCount > 5 ? "High" : stats.reportCount > 0 ? "Moderate" : "Clear"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Suspended users</span>
              <span className="text-sm font-medium text-zinc-200">{stats.recentUsers.filter((u: { isSuspended: boolean }) => u.isSuspended).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Avg posts/user</span>
              <span className="text-sm font-medium text-zinc-200">{stats.userCount > 0 ? (stats.postCount / stats.userCount).toFixed(1) : "0"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-medium text-zinc-300">Recent Admin Actions</h3>
          </div>
          {stats.adminLogs.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {stats.adminLogs.slice(0, 5).map((log: { id: string; action: string; details: string | null; createdAt: Date; admin: { username: string; displayName: string } }) => (
                <div key={log.id} className="text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-400 font-medium">{log.admin.displayName}</span>
                    <span className="text-zinc-600">{formatRelativeTime(log.createdAt)}</span>
                  </div>
                  <p className="text-zinc-500">{log.action.replace(/_/g, " ")} - {log.details}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600 text-center py-4">No admin actions yet</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* User management */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">User Management</h2>
            <span className="text-xs text-zinc-500">{stats.recentUsers.length} shown</span>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {stats.recentUsers.map((u: { id: string; username: string; displayName: string; email: string; isSuspended: boolean; isAdmin: boolean; isVerified: boolean; createdAt: Date; _count: { posts: number; followers: number } }) => (
              <div key={u.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{u.displayName}</p>
                    {u.isVerified && <svg className="h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  </div>
                  <p className="text-xs text-zinc-500">@{u.username} &middot; {u.email}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-zinc-600">{u._count.posts} posts</span>
                    <span className="text-[10px] text-zinc-600">{u._count.followers} followers</span>
                    <span className="text-[10px] text-zinc-600">{formatRelativeTime(u.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {u.isSuspended && (
                    <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Suspended</span>
                  )}
                  {u.isAdmin && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                  <AdminActions type="user" id={u.id} isSuspended={u.isSuspended} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Moderation queue */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">Moderation Queue</h2>
            {stats.reportCount > 0 && (
              <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{stats.reportCount} pending</span>
            )}
          </div>
          {stats.recentReports.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {stats.recentReports.map((report: { id: string; reason: string; createdAt: Date; reporter: { username: string; displayName: string }; reportedUser: { username: string; displayName: string } | null; reportedPost: { id: string; content: string } | null; reportedComment: { id: string; content: string } | null }) => (
                <div key={report.id} className="py-3 px-3 rounded-xl border border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium">{report.reason}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Reported by <span className="text-zinc-400">@{report.reporter.username}</span>
                        {report.reportedUser && <> about <span className="text-zinc-400">@{report.reportedUser.username}</span></>}
                      </p>
                      {report.reportedPost && (
                        <div className="mt-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                          <p className="text-xs text-zinc-400 line-clamp-2">{report.reportedPost.content}</p>
                        </div>
                      )}
                      {report.reportedComment && (
                        <div className="mt-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                          <p className="text-xs text-zinc-400 line-clamp-2">Comment: {report.reportedComment.content}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-1">{formatRelativeTime(report.createdAt)}</p>
                    </div>
                    <AdminActions type="report" id={report.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Flag className="h-8 w-8 text-zinc-800 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No pending reports</p>
              <p className="text-xs text-zinc-600 mt-1">The community is behaving well</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
