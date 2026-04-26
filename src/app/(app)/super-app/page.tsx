import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, Rocket, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { MigrationPlanner } from "./migration-planner";
import { getSupportedLegacyApps } from "@/lib/super-app-migration";
import { getCachedSuperAppReadinessReport } from "@/lib/super-app-readiness";

export default async function SuperAppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [report, supportedApps] = await Promise.all([
    getCachedSuperAppReadinessReport(user.id),
    getSupportedLegacyApps(),
  ]);
  const completedTasks = report.migrationTasks.filter((task) => task.completed).length;

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-sky-950/20 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-sky-500/20 text-sky-100 hover:bg-sky-500/20">Super App Replacement Center</Badge>
          <Badge variant="secondary" className="bg-white/10 text-slate-100">Readiness score: {report.overallScore}/100</Badge>
        </div>
        <h1 className="text-3xl font-semibold text-white">Your path to replacing every social + messaging app</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
          This dashboard converts the roadmap into measurable account-level progress so you can confidently migrate from
          fragmented apps into one daily workflow.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {report.domains.map((domain) => (
          <Card key={domain.key} className="border-white/10 bg-slate-900/60 text-slate-100">
            <CardHeader className="space-y-1">
              <CardDescription className="text-slate-300">{domain.label}</CardDescription>
              <CardTitle className="text-2xl">{domain.score}/100</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${domain.score}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-300">{domain.description}</p>
              <p className="mt-2 text-xs font-semibold text-sky-200">Target: {domain.target}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-emerald-400/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-100">
              <Rocket className="h-4 w-4" />
              Migration assistant checklist
            </CardTitle>
            <CardDescription className="text-emerald-200/90">
              Complete these milestones to make Mesh.me your only social + messaging app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.migrationTasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-slate-100 transition hover:border-sky-300/30 hover:bg-slate-900/50"
              >
                <span className="flex items-center gap-2">
                  {task.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4 text-slate-400" />}
                  {task.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
            <p className="pt-2 text-xs text-emerald-100">{completedTasks}/{report.migrationTasks.length} tasks completed.</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/10 bg-slate-900/60 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-sky-300" />
                Live replacement metrics
              </CardTitle>
              <CardDescription className="text-slate-300">These numbers are calculated from your real Mesh account activity.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <MetricRow label="Connected platforms" value={report.metrics.connectedAccounts} />
                <MetricRow label="Active connections" value={report.metrics.activeConnections} />
                <MetricRow label="Conversation threads" value={report.metrics.conversationThreads} />
                <MetricRow label="Messages sent" value={report.metrics.messagesSent} />
                <MetricRow label="Posts created" value={report.metrics.postsCreated} />
                <MetricRow label="Imported records" value={report.metrics.importedRecords} />
              </dl>
              <Link
                href="/api/super-app/readiness"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                View readiness JSON
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-amber-400/30 bg-amber-500/5 text-amber-50">
            <CardHeader>
              <CardTitle className="text-base">Priority actions for speed to replacement</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-100">
                {report.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-indigo-400/30 bg-indigo-500/5 text-indigo-50">
        <CardHeader>
          <CardTitle className="text-base">Legacy app migration planner</CardTitle>
          <CardDescription className="text-indigo-100/90">
            Select the apps you want to remove and Mesh.me will generate a targeted migration plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MigrationPlanner apps={supportedApps} />
        </CardContent>
      </Card>
    </main>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
      <dt className="text-slate-300">{label}</dt>
      <dd className="font-semibold text-slate-100">{value.toLocaleString()}</dd>
    </div>
  );
}
