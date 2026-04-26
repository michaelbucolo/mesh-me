import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck } from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6">
      <MeshBackground density={30} className="opacity-20" />

      <div className="relative z-10 text-center max-w-2xl">
        <MeshiLogo size={72} color="blue" mood="surprised" />

        <h1 className="font-display text-6xl font-extrabold mt-6 mb-3" style={{ color: "var(--text-primary)" }}>
          404
        </h1>
        <p className="text-lg font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
          Lost in the mesh
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>
          This page doesn&apos;t exist or has been moved. Let&apos;s get you back.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/mesh"
            className="brand-button text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg inline-flex items-center gap-2"
          >
            Back to the Mesh <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all inline-flex items-center"
            style={{ border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}
          >
            Home
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/features" className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 text-left transition hover:border-[var(--border-hover)]">
            <Compass className="mb-3 h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Browse public routes</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Go to Features, About, Trust, Privacy, or Terms.</p>
          </Link>
          <Link href="/trust" className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 text-left transition hover:border-[var(--border-hover)]">
            <ShieldCheck className="mb-3 h-4 w-4 text-emerald-400" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Check launch trust details</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Review privacy, security, and policy routes from one place.</p>
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs" style={{ color: "var(--text-muted)" }}>
        &copy; {new Date().getFullYear()} mesh.me
      </footer>
    </div>
  );
}
