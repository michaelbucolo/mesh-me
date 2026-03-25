import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800/50 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">m</span>
            </div>
            <span className="text-xl font-bold text-zinc-100">mesh<span className="text-indigo-400">.me</span></span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-zinc-100 mb-8">Terms of Service</h1>
        <div className="prose prose-invert prose-zinc max-w-none space-y-6 text-zinc-400 text-sm leading-relaxed">
          <p>Last updated: March 2026</p>
          <h2 className="text-xl font-semibold text-zinc-200">1. Acceptance of Terms</h2>
          <p>By accessing or using mesh.me, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
          <h2 className="text-xl font-semibold text-zinc-200">2. User Accounts</h2>
          <p>You must be at least 13 years old to create an account. You are responsible for maintaining the security of your account and password. mesh.me cannot and will not be liable for any loss or damage from your failure to comply with this security obligation.</p>
          <h2 className="text-xl font-semibold text-zinc-200">3. User Content</h2>
          <p>You retain ownership of content you create and share on mesh.me. By posting content, you grant mesh.me a non-exclusive license to display, distribute, and promote your content within the platform. You are responsible for the content you post and must not post content that violates any laws or the rights of others.</p>
          <h2 className="text-xl font-semibold text-zinc-200">4. Prohibited Conduct</h2>
          <p>Users must not: harass or bully others, post illegal content, spam or manipulate platform features, impersonate others, attempt to access other users&apos; accounts, or violate any applicable laws.</p>
          <h2 className="text-xl font-semibold text-zinc-200">5. Community Guidelines</h2>
          <p>mesh.me is a platform built on respect and authentic connection. We expect all users to engage respectfully, contribute meaningfully, and help maintain a positive environment for everyone.</p>
          <h2 className="text-xl font-semibold text-zinc-200">6. Termination</h2>
          <p>mesh.me reserves the right to suspend or terminate accounts that violate these terms or our community guidelines. Users may also delete their accounts at any time through the settings page.</p>
          <h2 className="text-xl font-semibold text-zinc-200">7. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
        </div>
      </main>
    </div>
  );
}
