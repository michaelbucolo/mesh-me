import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sparkles, Users, MessageCircle, Palette, Compass, Shield, Waypoints, LayoutGrid, Link2, Zap, Globe } from "lucide-react";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/feed");

  return (
    <div className="min-h-screen bg-zinc-950 mesh-bg noise-overlay">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/30 glass">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">m</span>
            </div>
            <span className="text-xl font-bold text-zinc-100">mesh<span className="text-blue-400">.me</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/about" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">About</Link>
            <Link href="/features" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Features</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-4 py-2">Sign in</Link>
            <Link href="/signup" className="text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-2 rounded-xl hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/20 font-medium">Join mesh.me</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-[100px] float-orb" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-400/6 rounded-full blur-[80px] float-orb-delayed" />
          <div className="absolute bottom-1/4 left-1/2 w-[300px] h-[300px] bg-cyan-400/4 rounded-full blur-[70px] float-orb-slow" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-sm text-zinc-400 mb-8">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span>A new kind of social platform</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-glow">
            <span className="text-zinc-100">Your identity.</span>
            <br />
            <span className="gradient-text">Your people.</span>
            <br />
            <span className="text-zinc-100">Your space.</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            mesh.me is a social platform where identity matters. Express who you are, discover people you genuinely connect with, and build communities around shared creativity and energy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto text-center bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3.5 rounded-xl text-base font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40">
              Join mesh.me
            </Link>
            <Link href="/about" className="w-full sm:w-auto text-center border border-zinc-700 text-zinc-300 px-8 py-3.5 rounded-xl text-base font-medium hover:bg-zinc-800 hover:text-zinc-100 transition-all">
              Explore the vision
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-12 border-y border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 text-sm text-zinc-500">
            {["Identity-first", "Built for real connection", "Creator-friendly", "Community-powered", "Expressive by design"].map((phrase) => (
              <span key={phrase} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {phrase}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Highlights */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">Three powerful ways to connect</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">mesh.me reimagines how you interact with the social web through three groundbreaking experiences.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-16 stagger-children">
            {[
              { icon: Waypoints, title: "The Mesh", desc: "Explore your social universe through an interactive, dynamic network graph. See how your connections, communities, tags, and posts all weave together in real time.", gradient: "from-blue-500 to-cyan-500" },
              { icon: LayoutGrid, title: "Custom Feed", desc: "Your feed, your rules. Switch between Instagram Reels, Twitter/X, TikTok, or YouTube Shorts layouts. Aggregate content from every platform you follow.", gradient: "from-blue-400 to-blue-300" },
              { icon: MessageCircle, title: "MeChat", desc: "All your conversations in one place. Merge messages from Instagram, X, Discord, and more into a single unified inbox with native mesh.me messaging.", gradient: "from-blue-400 to-cyan-400" },
            ].map((feature) => (
              <div key={feature.title} className="group glass-card rounded-2xl p-6 card-shine">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-Platform Section */}
      <section className="py-24 px-6 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">One account. Every platform.</h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Connect all your social accounts. Interact with content natively across platforms without ever leaving mesh.me.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-4 md:grid-cols-8 gap-4 mb-12">
          {[
            { name: "Instagram", color: "#E4405F" }, { name: "YouTube", color: "#FF0000" },
            { name: "TikTok", color: "#69C9D0" }, { name: "X", color: "#1DA1F2" },
            { name: "Twitch", color: "#9146FF" }, { name: "Spotify", color: "#1DB954" },
            { name: "Discord", color: "#5865F2" }, { name: "GitHub", color: "#888" },
          ].map((platform) => (
            <div key={platform.name} className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xs border border-zinc-700" style={{ backgroundColor: platform.color + "20", color: platform.color }}>
                {platform.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[10px] text-zinc-500">{platform.name}</span>
            </div>
          ))}
        </div>
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            { icon: Link2, title: "Connect Accounts", desc: "Link 16+ social platforms to your mesh.me profile" },
            { icon: Globe, title: "Cross-Interact", desc: "Like, comment, and follow on any platform natively" },
            { icon: Zap, title: "AI Summaries", desc: "Smart notifications digest across all your platforms" },
          ].map((f) => (
            <div key={f.title} className="text-center p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
              <f.icon className="h-5 w-5 text-blue-400 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-zinc-200 mb-1">{f.title}</h4>
              <p className="text-xs text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">Built different, on purpose</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Every feature is designed to help you express yourself, find your people, and build something real.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {[
              { icon: Palette, title: "Expressive Profiles", desc: "Your profile is your digital identity. Customize your space with accent colors, featured content, interests, and links that show who you really are." },
              { icon: Compass, title: "Meaningful Discovery", desc: "Find people based on shared interests, mutual connections, and creative overlap. Not just what's trending, but what truly resonates with you." },
              { icon: Users, title: "Real Communities", desc: "Build and join communities around shared interests, creativity, and energy. More than group chats. Spaces that feel like home." },
              { icon: MessageCircle, title: "Real-time Connection", desc: "Direct messaging that feels personal. Real-time presence, read states, and a clean interface designed for genuine conversation." },
              { icon: Sparkles, title: "Creator-friendly", desc: "Whether you make music, art, videos, code, or ideas, mesh.me gives you the tools to share your work and grow an authentic audience." },
              { icon: Shield, title: "Privacy & Safety", desc: "Control who sees your content, who can message you, and how you appear. Your space, your rules. Safety is built in, not bolted on." },
            ].map((feature) => (
              <div key={feature.title} className="group glass-card rounded-2xl p-6 card-shine">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision section */}
      <section className="py-24 px-6 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-6">The internet should feel more human</h2>
          <p className="text-zinc-400 text-lg leading-relaxed mb-6">
            Social media today feels fragmented and performative. You post into the void, chase metrics that don&apos;t matter, and scroll through content from people you don&apos;t connect with.
          </p>
          <p className="text-zinc-400 text-lg leading-relaxed mb-6">
            mesh.me is different. It&apos;s a platform where your identity matters more than your follower count. Where communities are built on genuine shared interest. Where discovery means finding people who actually get you.
          </p>
          <p className="text-zinc-300 text-lg leading-relaxed font-medium">
            Not just another feed. Not just another app. A place where people actually mesh.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-zinc-100">Find your people. </span>
            <span className="gradient-text">Build your presence.</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-8">Mesh for real.</p>
          <Link href="/signup" className="inline-flex bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3.5 rounded-xl text-base font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25">
            Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">m</span>
            </div>
            <span className="text-sm font-semibold text-zinc-400">mesh.me</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/about" className="hover:text-zinc-300 transition-colors">About</Link>
            <Link href="/features" className="hover:text-zinc-300 transition-colors">Features</Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
          </div>
          <p className="text-xs text-zinc-600">&copy; 2026 mesh.me. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
