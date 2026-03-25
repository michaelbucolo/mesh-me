import Link from "next/link";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-zinc-100 mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-zinc-400 text-sm leading-relaxed">
          <p>Last updated: March 2026</p>
          <h2 className="text-xl font-semibold text-zinc-200">1. Information We Collect</h2>
          <p>We collect information you provide when creating an account (email, username, display name, profile details), content you create (posts, comments, messages), and usage data (interactions, preferences).</p>
          <h2 className="text-xl font-semibold text-zinc-200">2. How We Use Your Information</h2>
          <p>We use your information to provide and improve mesh.me, personalize your experience, recommend content and connections, send notifications, and maintain platform safety.</p>
          <h2 className="text-xl font-semibold text-zinc-200">3. Information Sharing</h2>
          <p>We do not sell your personal information. Profile information you choose to make public is visible to other users. We may share information with service providers who help operate the platform, or when required by law.</p>
          <h2 className="text-xl font-semibold text-zinc-200">4. Your Privacy Controls</h2>
          <p>You can control your profile visibility, who can message you, and manage blocked users through your settings. You can request to download or delete your data at any time.</p>
          <h2 className="text-xl font-semibold text-zinc-200">5. Data Security</h2>
          <p>We implement industry-standard security measures including encrypted passwords, secure sessions, and regular security audits to protect your information.</p>
          <h2 className="text-xl font-semibold text-zinc-200">6. Contact</h2>
          <p>For privacy inquiries, contact us at privacy@mesh.me.</p>
        </div>
      </main>
    </div>
  );
}
