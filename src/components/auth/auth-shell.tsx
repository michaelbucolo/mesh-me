import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { meshBrand } from "@/lib/brand";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="auth-shell auth-studio relative isolate text-[var(--text-primary)]">
      <header className="auth-studio-header">
        <MeshiBrandLockup href="/" size={32} label={meshBrand.name} className="text-lg" />
        <Link href="/login"><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</Link>
      </header>
      <div className="auth-shell-grid auth-studio-grid">
        <section className="auth-studio-intro">
          <div className="auth-studio-meshi" aria-hidden="true"><ShieldCheck size={44} strokeWidth={1.2} /></div>
          <p className="public-kicker mt-3 flex w-fit"><ShieldCheck size={14} aria-hidden="true" /> A little peace of mind</p>
          <h1>{title}</h1>
          <p className="auth-studio-copy">{description}</p>
          <div className="auth-studio-caption"><span aria-hidden="true" /> Your world is right where you left it.</div>
        </section>
        <section className="auth-studio-card">{children}</section>
      </div>
      <footer className="auth-studio-footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Need a hand?</Link></footer>
    </main>
  );
}
