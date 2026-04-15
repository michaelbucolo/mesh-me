import type { Metadata } from "next";
import Link from "next/link";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";

export const metadata: Metadata = {
  title: "About — mesh.me",
  description: "One internet. One you. Learn about mesh.me and our mission to unify your digital life.",
};

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)]">
      <MeshBackground density={40} className="opacity-25" />

      <header className="relative z-10 border-b border-[var(--glass-border)] glass sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MeshiLogo size={28} color="blue" mood="happy" />
            <span className="brand-wordmark text-lg">mesh<span className="brand-wordmark-accent">.me</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/features" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5">Features</Link>
            <Link href="/" className="brand-button text-sm text-white px-5 py-2 rounded-xl font-medium">Enter the Mesh</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-6">About mesh.me</h1>
        <div className="space-y-6 text-[var(--text-tertiary)] text-lg leading-relaxed">
          <p>
            The internet wasn&apos;t supposed to feel this fragmented. Fifteen apps, fifteen logins, fifteen versions of you — scattered across platforms that don&apos;t talk to each other and don&apos;t answer to you.
          </p>
          <p>
            mesh.me exists to fix that. One place for your entire digital life — every connection, every conversation, every community — unified under an identity you actually own.
          </p>
          <p className="text-[var(--text-secondary)] font-medium text-xl">
            One internet. One you. That&apos;s the mesh.
          </p>
          <p>
            When your interests, creativity, and energy overlap with someone else&apos;s, that&apos;s where real connection happens. We call it meshing. And we built a platform that makes it effortless to find, nurture, and protect those connections.
          </p>

          <h2 className="text-2xl font-bold text-[var(--text-primary)] pt-6">Our Principles</h2>
          <ul className="space-y-4">
            {[
              { title: "Privacy is not a feature. It\u2019s the foundation.", desc: "Your data belongs to you. Period." },
              { title: "No ads. No algorithms. No compromise.", desc: "We will never sell your attention to the highest bidder." },
              { title: "Identity over vanity.", desc: "Your profile reflects who you are, not how many people follow you." },
              { title: "Connection over addiction.", desc: "Designed for real interaction, not infinite scrolling." },
              { title: "Built for humans.", desc: "Every pixel serves the person using it, not the platform profiting from it." },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <div className="h-1.5 w-1.5 rounded-full mt-3 flex-shrink-0" style={{ background: "var(--accent)" }} />
                <span>
                  <strong className="text-[var(--text-primary)]">{item.title}</strong> {item.desc}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold text-[var(--text-primary)] pt-6">Meet Meshi</h2>
          <p>
            Meshi is your companion on the mesh — a personalized guide that travels with you as you explore your digital world. Meshi learns from your mesh, helps you find what you need, and even interacts with other users&apos; Meshis in real time. Think of Meshi as the part of you that lives in the mesh, always ready to help and always uniquely yours.
          </p>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--glass-border)] py-8 mt-8">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>&copy; 2026 mesh.me. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[var(--text-tertiary)] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[var(--text-tertiary)] transition-colors">Terms of Service</Link>
            <Link href="/about" className="hover:text-[var(--text-tertiary)] transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
