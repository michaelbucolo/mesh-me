import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-8">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-8 text-center shadow-[var(--shadow-sm)] sm:p-12">
        <p className="brand-wordmark text-3xl text-[var(--text-primary)]">
          mesh<span className="brand-wordmark-accent">.me</span>
        </p>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-[var(--text-primary)]">Welcome</h1>
        <p className="mx-auto mt-4 max-w-md text-base text-[var(--text-secondary)]">
          A simple way to get into the website.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/login" className="brand-button rounded-2xl px-5 py-3 text-sm font-semibold text-white">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)]"
          >
            Sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
