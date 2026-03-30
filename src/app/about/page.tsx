import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] mesh-bg">
      <header className="border-b border-[var(--border-primary)] glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="brand-logo h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="4" r="2" fill="white" opacity="0.9"/>
                <circle cx="4" cy="20" r="2" fill="white" opacity="0.9"/>
                <circle cx="20" cy="20" r="2" fill="white" opacity="0.9"/>
                <circle cx="12" cy="12" r="2.5" fill="white"/>
                <line x1="12" y1="6" x2="12" y2="9.5" stroke="white" strokeWidth="1.2" opacity="0.6"/>
                <line x1="5.5" y1="19" x2="10" y2="13.5" stroke="white" strokeWidth="1.2" opacity="0.6"/>
                <line x1="18.5" y1="19" x2="14" y2="13.5" stroke="white" strokeWidth="1.2" opacity="0.6"/>
              </svg>
            </div>
            <span className="brand-wordmark text-xl">mesh<span className="brand-wordmark-accent">.me</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2">Sign in</Link>
            <Link href="/signup" className="brand-button text-sm text-white px-5 py-2 rounded-xl font-medium">Join mesh.me</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-24">
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
          <ul className="space-y-3">
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full mt-3 flex-shrink-0" style={{ background: "var(--accent)" }} /><span><strong className="text-[var(--text-primary)]">Privacy is not a feature. It&apos;s the foundation.</strong> Your data belongs to you. Period.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full mt-3 flex-shrink-0" style={{ background: "var(--accent)" }} /><span><strong className="text-[var(--text-primary)]">No ads. No algorithms. No compromise.</strong> We will never sell your attention to the highest bidder.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full mt-3 flex-shrink-0" style={{ background: "var(--accent)" }} /><span><strong className="text-[var(--text-primary)]">Identity over vanity.</strong> Your profile reflects who you are, not how many people follow you.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full mt-3 flex-shrink-0" style={{ background: "var(--accent)" }} /><span><strong className="text-[var(--text-primary)]">Connection over addiction.</strong> Designed for real interaction, not infinite scrolling.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full mt-3 flex-shrink-0" style={{ background: "var(--accent)" }} /><span><strong className="text-[var(--text-primary)]">Built for humans.</strong> Every pixel serves the person using it, not the platform profiting from it.</span></li>
          </ul>
        </div>
      </main>
    </div>
  );
}
