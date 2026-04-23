import { redirect } from "next/navigation";
import { Activity, BarChart3, Database, Eye, Lock, ServerCog, ShieldCheck, Trash2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGlobalMeshStatus, getMeshPrivacy } from "@/lib/queries";
import { getPlatformAnalyticsSummary } from "@/lib/platform-sync";
import { AnalyticsControls } from "@/components/analytics/analytics-controls";
import { PLATFORM_CAPABILITIES } from "@/lib/platform-capabilities";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [
    platformSummary,
    privacy,
    globalMesh,
    postCount,
    commentCount,
    messageCount,
    meChatSessionCount,
    notificationCount,
    connectedAccountCount,
    platformPostCount,
    platformCommentCount,
    platformFollowerCount,
  ] = await Promise.all([
    getPlatformAnalyticsSummary().catch(() => []),
    getMeshPrivacy().catch(() => null),
    getGlobalMeshStatus().catch(() => null),
    safeCount(() => prisma.post.count({ where: { authorId: user.id } })),
    safeCount(() => prisma.comment.count({ where: { authorId: user.id } })),
    safeCount(() => prisma.message.count({ where: { senderId: user.id } })),
    safeCount(() => prisma.meChatSession.count({
      where: {
        OR: [
          { hostId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      },
    })),
    safeCount(() => prisma.notification.count({ where: { recipientId: user.id } })),
    safeCount(() => prisma.connectedAccount.count({ where: { userId: user.id } })),
    safeCount(() => prisma.platformPost.count({ where: { connectedAccount: { userId: user.id } } })),
    safeCount(() => prisma.platformComment.count({ where: { connectedAccount: { userId: user.id } } })),
    safeCount(() => prisma.platformFollower.count({ where: { connectedAccount: { userId: user.id } } })),
  ]);

  const dataInventory = [
    { label: "Mesh posts", value: postCount, icon: Activity },
    { label: "Comments", value: commentCount, icon: BarChart3 },
    { label: "Messages", value: messageCount, icon: Database },
    { label: "MeChat rooms", value: meChatSessionCount, icon: ServerCog },
    { label: "Notifications", value: notificationCount, icon: Eye },
    { label: "Connected platforms", value: connectedAccountCount, icon: ShieldCheck },
    { label: "Synced posts", value: platformPostCount, icon: Database },
    { label: "Synced comments", value: platformCommentCount + platformFollowerCount, icon: Activity },
  ];

  const trustControls = [
    { icon: Eye, label: "Mesh visibility", value: privacy?.meshVisibility || "friends", tone: "blue" },
    { icon: Lock, label: "Connection visibility", value: privacy?.showConnections ? "Visible where allowed" : "Hidden", tone: "green" },
    { icon: BarChart3, label: "Public stats", value: privacy?.showStats ? "Visible" : "Hidden", tone: "amber" },
    { icon: ShieldCheck, label: "Global Mesh", value: globalMesh?.isActive ? "Opted in" : "Opted out", tone: "green" },
  ];

  const totalImported = platformPostCount + platformCommentCount + platformFollowerCount;

  return (
    <div className="grid gap-6">
      <section className="mesh-section rounded-3xl p-5 md:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="mesh-kicker">Analytics and Privacy</p>
            <h1 className="mesh-title mt-2 text-3xl md:text-4xl">Transparency is a product surface.</h1>
            <p className="mesh-copy mt-3 max-w-3xl text-sm">
              This is where Mesh.me shows what is stored, what is synced, what can be exported, what can be deleted, and how connected platforms are allowed to behave.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroMetric label="Imported records" value={totalImported} />
            <HeroMetric label="Active sources" value={connectedAccountCount} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {trustControls.map((item) => (
          <div key={item.label} className="mesh-stat-card">
            <item.icon className={`mb-3 h-5 w-5 ${item.tone === "green" ? "text-emerald-400" : item.tone === "amber" ? "text-amber-400" : "text-[var(--accent)]"}`} />
            <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="mesh-section rounded-3xl p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Platform health</h2>
              <p className="text-xs text-[var(--text-muted)]">Connected account sync status and imported activity.</p>
            </div>
            <Database className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div className="grid gap-3">
            {(platformSummary || []).length === 0 ? (
              <p className="rounded-2xl border border-[var(--border-primary)] p-4 text-sm text-[var(--text-secondary)]">
                No connected platform analytics yet. Connect accounts to start building your source-aware Mesh.
              </p>
            ) : (
              platformSummary?.map((account) => (
                <div key={account.platform} className="mesh-panel grid gap-3 rounded-2xl p-4 lg:grid-cols-[1.2fr_repeat(4,0.8fr)]">
                  <div>
                    <p className="text-sm font-bold capitalize text-[var(--text-primary)]">{account.platform}</p>
                    <p className="text-xs text-[var(--text-muted)]">{account.platformUsername || "No username"}</p>
                  </div>
                  <Metric label="Status" value={account.syncStatus} />
                  <Metric label="Posts" value={account.postCount} />
                  <Metric label="Followers" value={account.followerCount} />
                  <Metric label="Views" value={account.totalViews} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mesh-section rounded-3xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Data controls</h2>
          </div>
          <p className="mb-4 text-xs leading-5 text-[var(--text-secondary)]">
            Export your Mesh or delete synced platform data without unlinking accounts.
          </p>
          <AnalyticsControls />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dataInventory.map((item) => (
          <div key={item.label} className="mesh-stat-card">
            <item.icon className="mb-3 h-5 w-5 text-[var(--accent)]" />
            <p className="text-2xl font-black text-[var(--text-primary)]">{item.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="mesh-section rounded-3xl p-5">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Platform capabilities</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Mesh.me separates shipped support from work that depends on platform approvals, API limits, or realtime infrastructure.
          </p>
        </div>
        <div className="grid gap-3">
          {PLATFORM_CAPABILITIES.slice(0, 8).map((capability) => (
            <div key={capability.platform} className="mesh-panel grid gap-3 rounded-2xl p-4 lg:grid-cols-[14rem_1fr]">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{capability.displayName}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{capability.auth}</p>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <CapabilityPill label="Import" active={capability.importContent} />
                  <CapabilityPill label="Analytics" active={capability.importAnalytics} />
                  <CapabilityPill label="Post" active={capability.crossPost} />
                  <CapabilityPill label="Delete" active={capability.deleteRemoteContent} />
                  <CapabilityPill label="Messages" active={capability.messageSync} />
                </div>
                <p className="text-xs leading-5 text-[var(--text-muted)]">{capability.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function safeCount(load: () => Promise<number>) {
  try {
    return await load();
  } catch {
    return 0;
  }
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4">
      <p className="text-2xl font-black text-[var(--text-primary)]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{value ?? "n/a"}</p>
    </div>
  );
}

function CapabilityPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={active
      ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
      : "rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
    }>
      {label}
    </span>
  );
}
