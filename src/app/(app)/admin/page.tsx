import { getCurrentUser } from "@/lib/auth";
import { getAdminStats } from "@/lib/queries";
import { redirect } from "next/navigation";
import { Shield, Users, FileText, Flag, BarChart3 } from "lucide-react";
import { AdminActions } from "./admin-actions";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/feed");

  const stats = await getAdminStats();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-6 w-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Admin Panel</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Users", value: stats.userCount, icon: Users, color: "text-indigo-400" },
          { label: "Posts", value: stats.postCount, icon: FileText, color: "text-purple-400" },
          { label: "Communities", value: stats.communityCount, icon: BarChart3, color: "text-cyan-400" },
          { label: "Pending Reports", value: stats.reportCount, icon: Flag, color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm text-zinc-400">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent users */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Recent Users</h2>
          <div className="space-y-3">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{u.displayName}</p>
                  <p className="text-xs text-zinc-500">@{u.username} &middot; {u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.isSuspended && (
                    <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Suspended</span>
                  )}
                  {u.isAdmin && (
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                  <AdminActions type="user" id={u.id} isSuspended={u.isSuspended} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending reports */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Pending Reports</h2>
          {stats.recentReports.length > 0 ? (
            <div className="space-y-3">
              {stats.recentReports.map((report) => (
                <div key={report.id} className="py-3 border-b border-zinc-800 last:border-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-zinc-200">{report.reason}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Reported by @{report.reporter.username}
                        {report.reportedUser && ` about @${report.reportedUser.username}`}
                      </p>
                      {report.reportedPost && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          Post: &ldquo;{report.reportedPost.content}&rdquo;
                        </p>
                      )}
                    </div>
                    <AdminActions type="report" id={report.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 py-4 text-center">No pending reports</p>
          )}
        </div>
      </div>
    </div>
  );
}
