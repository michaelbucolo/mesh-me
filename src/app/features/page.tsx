import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Users, MessageCircle, Palette, Compass, Shield, Zap, Heart, Globe, Waypoints } from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { MeshBackground } from "@/components/mesh-background";

export const metadata: Metadata = {
  title: "Features — mesh.me",
  description: "Explore mesh.me features: The Mesh, MeChat, Meshi companion, Communities, and more.",
};

export default function FeaturesPage() {
  const features = [
    { icon: Waypoints, title: "The Mesh", desc: "A living, interactive constellation of your entire digital world. Navigate your connections, posts, communities, and interests in a way that\u2019s never existed before." },
    { icon: Palette, title: "Your Identity, Amplified", desc: "Profiles that feel like living digital identity cards. Custom accent colors, interest tags, social links, and creative expression tools — because you are more than a bio and a follower count." },
    { icon: Compass, title: "Discovery That Feels Human", desc: "Find people through shared interests, mutual connections, and creative energy. No algorithm deciding what you see — you explore on your terms." },
    { icon: Users, title: "Communities, Not Crowds", desc: "Build and join spaces around niche interests, creative collaboration, and shared identity. Each community has its own culture, its own rules." },
    { icon: MessageCircle, title: "MeChat — Unified Messaging", desc: "Every conversation, every platform, one inbox. Clean, real-time messaging with read states and presence. Conversations that feel personal and intentional." },
    { icon: Sparkles, title: "Meshi — Your Companion", desc: "A personalized companion that travels with you across the mesh. Meshi learns your world, answers your questions, delivers messages, and interacts with other Meshis in real time." },
    { icon: Heart, title: "Interactions That Matter", desc: "Reactions, threaded comments, and reposts. Every interaction is designed to feel meaningful, not performative." },
    { icon: Shield, title: "Private by Design", desc: "Granular privacy controls, block and mute tools, zero tracking, zero ads. Your space, your rules, your data." },
    { icon: Zap, title: "Alive & Responsive", desc: "Real-time notifications, presence indicators, instant messaging, and live feed updates. mesh.me feels alive because it is." },
    { icon: Globe, title: "Your Entire Internet, Unified", desc: "Connect every platform you use. Interact with content across the web from one place. One mesh for your whole digital life." },
  ];

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
            <Link href="/about" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5">About</Link>
            <Link href="/" className="brand-button text-sm text-white px-5 py-2 rounded-xl font-medium">Enter the Mesh</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">One platform. Every possibility.</h1>
          <p className="text-[var(--text-tertiary)] text-lg max-w-2xl mx-auto">Everything you need to connect, create, and own your digital life.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div key={feature.title} className="group rounded-2xl glass-card p-6 transition-all duration-300">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
                <feature.icon className="h-5 w-5" style={{ color: "var(--accent)" }} />
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
              <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link href="/" className="brand-button inline-flex text-white px-8 py-3.5 rounded-xl text-base font-medium shadow-lg">
            Join the Mesh
          </Link>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--glass-border)] py-8 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-[var(--text-muted)]">
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
