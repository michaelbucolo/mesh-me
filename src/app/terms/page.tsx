import type { Metadata } from "next";
import Link from "next/link";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";

export const metadata: Metadata = {
  title: "Terms of Service — mesh.me",
  description: "Terms of Service and legal conditions for mesh.me.",
};

const SECTIONS = [
  {
    title: "1. Agreement to these Terms",
    body: "By creating an account, accessing, or using mesh.me, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the Service.",
  },
  {
    title: "2. Eligibility and account security",
    body: "You must be at least 13 years old (or the minimum age required in your country). You are responsible for your account credentials, activity on your account, and promptly reporting unauthorized access.",
  },
  {
    title: "3. Your content and license",
    body: "You keep ownership of the content you post. To operate the Service, you grant mesh.me a non-exclusive, worldwide, royalty-free license to host, reproduce, display, distribute, and process that content only for product operations and safety enforcement.",
  },
  {
    title: "4. Acceptable use",
    body: "You may not use mesh.me for illegal activity, fraud, harassment, threats, coordinated abuse, malware, spam, IP infringement, or attempts to disrupt or scrape the Service without permission.",
  },
  {
    title: "5. Moderation and enforcement",
    body: "We may review reports, remove content, limit distribution, suspend, or terminate accounts that violate these Terms, Community Standards, or applicable law.",
  },
  {
    title: "6. Connected accounts and third-party services",
    body: "If you connect third-party platforms, you authorize access through provider-approved OAuth scopes. Third-party services are governed by their own terms. mesh.me is not endorsed by those providers and cannot guarantee their API uptime or feature continuity.",
  },
  {
    title: "7. Paid features (MeshPro)",
    body: "MeshPro billing is recurring unless canceled. You can cancel any time and keep access through the paid period. Taxes and regional rights (including refunds) follow applicable law and your checkout terms.",
  },
  {
    title: "8. Privacy and data controls",
    body: "Our Privacy Policy explains what we collect, why we collect it, and available controls (including account deletion and export where available).",
  },
  {
    title: "9. Intellectual property and DMCA",
    body: "mesh.me trademarks, product design, and software are protected by law. For copyright concerns, contact copyright@mesh.me with a complete DMCA notice.",
  },
  {
    title: "10. Service availability and changes",
    body: "We may update, suspend, or discontinue features. We work to maintain reliability but do not guarantee uninterrupted availability.",
  },
  {
    title: "11. Disclaimers",
    body: "The Service is provided \"as is\" and \"as available\" to the fullest extent permitted by law, without warranties of merchantability, fitness for a particular purpose, or non-infringement.",
  },
  {
    title: "12. Limitation of liability",
    body: "To the maximum extent allowed by law, mesh.me will not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages, or loss of profits/data arising from your use of the Service.",
  },
  {
    title: "13. Indemnification",
    body: "You agree to indemnify and hold harmless mesh.me and its affiliates from claims, liabilities, and expenses arising out of your content, your use of the Service, or your violation of these Terms.",
  },
  {
    title: "14. Dispute resolution and governing law",
    body: "Before filing formal claims, both parties agree to attempt informal resolution for 30 days. If unresolved, disputes are handled by binding arbitration unless law prohibits arbitration. Governing law: United States, excluding conflict-of-law rules.",
  },
  {
    title: "15. Changes to these Terms",
    body: "We may update these Terms. For material changes, we will provide reasonable notice before changes take effect. Continued use after effective date means acceptance.",
  },
  {
    title: "16. Contact",
    body: "Legal inquiries: legal@mesh.me",
  },
] as const;

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)]">
      <MeshBackground density={30} className="opacity-20" />

      <header className="relative z-10 border-b border-[var(--glass-border)] glass sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MeshiLogo size={28} color="blue" mood="happy" />
            <span className="brand-wordmark text-lg">mesh<span className="brand-wordmark-accent">.me</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5">About</Link>
            <Link href="/" className="brand-button text-sm text-white px-5 py-2 rounded-xl font-medium">Enter the Mesh</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl font-bold text-[var(--text-primary)] mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">Last updated: April 23, 2026</p>

        <div className="rounded-2xl border border-[var(--glass-border)] glass-surface p-4 mb-8">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            This page combines the mesh.me Terms and Conditions and Terms of Service. If translated versions conflict,
            the English version controls unless local law says otherwise.
          </p>
        </div>

        <div className="space-y-6 text-[var(--text-tertiary)] text-sm leading-relaxed">
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 text-xs text-[var(--text-muted)] leading-relaxed">
          <p>
            Privacy policy: <Link href="/privacy" className="underline" style={{ color: "var(--accent)" }}>mesh.me/privacy</Link>
          </p>
          <p>
            If you need a copy of these Terms for records, contact legal@mesh.me.
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
