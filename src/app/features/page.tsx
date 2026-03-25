import Link from "next/link";
import { Sparkles, Users, MessageCircle, Palette, Compass, Shield, Zap, Heart, Globe } from "lucide-react";

export default function FeaturesPage() {
  const features = [
    { icon: Palette, title: "Identity-Rich Profiles", desc: "Profiles that feel like living digital identity cards. Custom accent colors, interest tags, featured content, social links, and creative expression tools that let you show who you really are." },
    { icon: Compass, title: "Smart Discovery", desc: "Find people based on shared interests, mutual connections, community overlap, and creative energy. Discovery that feels personal, not algorithmic." },
    { icon: Users, title: "Community Spaces", desc: "Build and join communities around niche interests, fandoms, creative collaboration, and shared identity. Each community has its own culture and moderation." },
    { icon: MessageCircle, title: "Direct Messaging", desc: "Clean, real-time one-to-one messaging with read states, typing indicators, and online presence. Conversations that feel personal and intentional." },
    { icon: Sparkles, title: "Creative Posting", desc: "Share text, images, multi-image carousels, and tagged content. Rich post composer with drag-and-drop uploads, emoji picker, and community targeting." },
    { icon: Heart, title: "Reactions & Comments", desc: "Express yourself with reactions, threaded comments, and reposts. Every interaction is designed to feel meaningful, not performative." },
    { icon: Shield, title: "Privacy & Safety", desc: "Granular privacy controls, block and mute tools, content reporting, and community moderation. Your space, your rules." },
    { icon: Zap, title: "Real-time Everything", desc: "Live notifications, presence indicators, instant messaging, and real-time feed updates. The platform feels alive and responsive." },
    { icon: Globe, title: "Open & Extensible", desc: "Built with modern architecture ready for creator monetization, live rooms, events, mobile apps, and API integrations." },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 mesh-bg">
      <header className="border-b border-zinc-800/50 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">m</span>
            </div>
            <span className="text-xl font-bold text-zinc-100">mesh<span className="text-blue-400">.me</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-4 py-2">Sign in</Link>
            <Link href="/signup" className="text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-2 rounded-xl hover:from-blue-500 hover:to-blue-400 transition-all font-medium">Join mesh.me</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-100 mb-4">Everything you need</h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">A complete platform for expression, connection, and community.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-300">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                <feature.icon className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link href="/signup" className="inline-flex bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3.5 rounded-xl text-base font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25">
            Get started for free
          </Link>
        </div>
      </main>
    </div>
  );
}
