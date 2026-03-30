import Link from "next/link";
import { Sparkles, Users, MessageCircle, Palette, Compass, Shield, Zap, Heart, Globe } from "lucide-react";

export default function FeaturesPage() {
  const features = [
    { icon: Palette, title: "Your Identity, Amplified", desc: "Profiles that feel like living digital identity cards. Custom accent colors, interest tags, social links, and creative expression tools — because you are more than a bio and a follower count." },
    { icon: Compass, title: "Discovery That Feels Human", desc: "Find people through shared interests, mutual connections, and creative energy. No algorithm deciding what you see — you explore on your terms." },
    { icon: Users, title: "Communities, Not Crowds", desc: "Build and join spaces around niche interests, creative collaboration, and shared identity. Each community has its own culture, its own rules." },
    { icon: MessageCircle, title: "MeChat — Unified Messaging", desc: "Every conversation, every platform, one inbox. Clean, real-time messaging with read states and presence. Conversations that feel personal and intentional." },
    { icon: Sparkles, title: "Post Without Limits", desc: "Share text, images, carousels, and tagged content. A rich composer that gets out of your way and lets you create freely." },
    { icon: Heart, title: "Interactions That Matter", desc: "Reactions, threaded comments, and reposts. Every interaction is designed to feel meaningful, not performative." },
    { icon: Shield, title: "Private by Design", desc: "Granular privacy controls, block and mute tools, zero tracking, zero ads. Your space, your rules, your data." },
    { icon: Zap, title: "Alive & Responsive", desc: "Real-time notifications, presence indicators, instant messaging, and live feed updates. mesh.me feels alive because it is." },
    { icon: Globe, title: "Your Entire Internet, Unified", desc: "Connect every platform you use. Interact with content across the web from one place. One mesh for your whole digital life." },
  ];

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

      <main className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">One platform. Every possibility.</h1>
          <p className="text-[var(--text-tertiary)] text-lg max-w-2xl mx-auto">Everything you need to connect, create, and own your digital life.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="group rounded-2xl glass-card p-6 transition-all duration-300">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
                <feature.icon className="h-6 w-6" style={{ color: "var(--accent)" }} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
              <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link href="/signup" className="brand-button inline-flex text-white px-8 py-3.5 rounded-xl text-base font-medium shadow-lg">
            Join the Mesh
          </Link>
        </div>
      </main>
    </div>
  );
}
