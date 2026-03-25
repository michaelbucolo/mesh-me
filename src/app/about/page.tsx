import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 mesh-bg">
      <header className="border-b border-zinc-800/50 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">m</span>
            </div>
            <span className="text-xl font-bold text-zinc-100">mesh<span className="text-indigo-400">.me</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-4 py-2">Sign in</Link>
            <Link href="/signup" className="text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all font-medium">Join mesh.me</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-4xl md:text-5xl font-bold text-zinc-100 mb-6">About mesh.me</h1>
        <div className="space-y-6 text-zinc-400 text-lg leading-relaxed">
          <p>
            mesh.me was born from a simple observation: social media has become more about performance than connection. We scroll endlessly, chase metrics, and curate personas that don&apos;t reflect who we actually are.
          </p>
          <p>
            We believe the internet should feel more human. That your online identity should be as rich and multifaceted as you are. That communities should form around genuine shared interest, not just algorithmic coincidence.
          </p>
          <p className="text-zinc-300 font-medium text-xl">
            mesh.me is designed around a single idea: meaningful overlap between people.
          </p>
          <p>
            When your interests, creativity, values, and energy overlap with someone else&apos;s, that&apos;s where real connection happens. We call that meshing. And we&apos;re building a platform that makes it easy to find, nurture, and celebrate those connections.
          </p>
          <h2 className="text-2xl font-bold text-zinc-100 pt-6">Our Principles</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-3 flex-shrink-0" /><span><strong className="text-zinc-200">Identity over vanity metrics.</strong> Your profile should reflect who you are, not how many followers you have.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-3 flex-shrink-0" /><span><strong className="text-zinc-200">Connection over addiction.</strong> We design for meaningful interaction, not infinite scrolling.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-3 flex-shrink-0" /><span><strong className="text-zinc-200">Expression over sameness.</strong> Every profile, every community, every post should feel personal.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-3 flex-shrink-0" /><span><strong className="text-zinc-200">Community over noise.</strong> Quality interactions in smaller spaces beat shouting into the void.</span></li>
            <li className="flex items-start gap-3"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-3 flex-shrink-0" /><span><strong className="text-zinc-200">Safety by default.</strong> Privacy controls, moderation tools, and respectful norms are built in from day one.</span></li>
          </ul>
        </div>
      </main>
    </div>
  );
}
