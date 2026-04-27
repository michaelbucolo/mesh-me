import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Fingerprint, KeyRound, LockKeyhole, Network, ShieldCheck, Sparkles } from "lucide-react";
import { PublicSiteShell } from "@/components/layout/public-site-shell";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";

export const metadata: Metadata = {
  title: "Mesh.me Vision | Your World, Your Way",
  description: "The full Mesh.me product vision for the Mesh, Meshi, privacy, sync, identity, and encrypted social interoperability.",
};

const layers = [
  { icon: Fingerprint, title: "Identity layer", copy: "A user can hold multiple linked identities, like John and MediaMan, with separate permissions, visibility, audiences, and connected accounts." },
  { icon: Network, title: "Mesh graph", copy: "Every imported account, post, comment, like, group, channel, mention, tag, and connection becomes a node or edge in the user's living digital footprint." },
  { icon: Bot, title: "Meshi presence", copy: "Meshi follows the user through the product as a customizable bubble companion, guide, search agent, messenger, and public active-presence marker." },
  { icon: LockKeyhole, title: "Private compute", copy: "Personal indexing and AI context should run locally or in encrypted user-controlled spaces whenever possible, with minimal server-side knowledge." },
];

const examples = [
  "Who is John Manning and do we have any posts together?",
  "How many times have I been seen in a social media post?",
  "When was the last time I posted about my band?",
  "Has Jacob ever been to France?",
  "Let Stephen know I will be there soon.",
];

export default function VisionPage() {
  return (
    <PublicSiteShell>
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="mesh-kicker mb-4">Product vision</p>
          <h1 className="mesh-title text-4xl leading-tight md:text-6xl">Mesh.me is the public playground for your private internet life.</h1>
          <p className="simple-muted mt-6 max-w-3xl text-base md:text-lg">
            Mesh.me is designed to unify every internet interaction into one secure, transparent, user-owned experience. It should feel like a living map of a person's digital world, not another feed trying to trap attention.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white">Create your Mesh <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/trust" className="rounded-xl border border-[var(--border-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)]">Trust model</Link>
          </div>
        </div>
        <div className="mesh-section relative overflow-hidden p-7">
          <div className="absolute inset-0 mesh-lines opacity-40" />
          <div className="relative mx-auto flex h-72 max-w-md items-center justify-center">
            <div className="absolute h-56 w-56 rounded-full border border-[var(--border-primary)]" />
            <div className="absolute h-36 w-36 rounded-full border border-[var(--accent)] opacity-50" />
            <MeshiLogo size={92} color="blue" mood="happy" />
            {['John','MediaMan','YouTube','Instagram','Friends','Groups'].map((label, index) => (
              <div key={label} className="absolute rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]" style={{ transform: `rotate(${index * 60}deg) translateY(-118px) rotate(-${index * 60}deg)` }}>{label}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {layers.map((layer) => <article key={layer.title} className="simple-card p-5"><layer.icon className="mb-4 h-5 w-5 text-[var(--accent)]" /><h2 className="text-base font-bold text-[var(--text-primary)]">{layer.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{layer.copy}</p></article>)}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="mesh-section p-6">
          <ShieldCheck className="mb-4 h-6 w-6 text-[var(--accent)]" />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Privacy promise</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Mesh.me should never be built around selling user data. The product should use explicit consent, clear sync scopes, exportable user data, revocable connections, encrypted communication, and transparent logs showing exactly what was indexed, why it was indexed, and where it lives.</p>
        </article>
        <article className="mesh-section p-6">
          <KeyRound className="mb-4 h-6 w-6 text-[var(--accent)]" />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Security baseline</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">End-to-end encrypted messaging, encrypted tokens, least-privilege platform permissions, device-bound session controls, account verification, bot resistance, and audit-ready data flows are launch requirements, not future polish.</p>
        </article>
      </section>

      <section className="mt-12 simple-card p-6 md:p-8">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-[var(--accent)]" /><h2 className="text-2xl font-bold text-[var(--text-primary)]">Meshi should answer real internet-life questions</h2></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {examples.map((example) => <div key={example} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">“{example}”</div>)}
        </div>
      </section>
    </PublicSiteShell>
  );
}
