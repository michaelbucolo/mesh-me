import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6 shadow-[var(--shadow-lg)] sm:p-8">
        <div className="mb-6 text-center">
          <Link href="/" className="brand-wordmark text-2xl text-[var(--text-primary)]">
            mesh<span className="brand-wordmark-accent">.me</span>
          </Link>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-[var(--text-primary)]">Create account</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">A clean start. Just sign up and enter the website.</p>
        </div>

        <SignupForm />
      </section>
    </main>
  );
}
