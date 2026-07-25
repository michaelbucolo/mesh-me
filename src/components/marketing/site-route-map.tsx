"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useMotionTemplate, useReducedMotion, useSpring, type Variants } from "framer-motion";
import { ArrowRight, BarChart3, Lock, MessageCircle, Rss, ShieldCheck, Sparkles, Waypoints } from "lucide-react";

const routes = [
  {
    href: "/",
    icon: Waypoints,
    title: "The Mesh",
    description: "Explore the living map of your posts, people, communities, and connected platforms.",
    accent: "text-cyan-300",
  },
  {
    href: "/features",
    icon: Rss,
    title: "Feed and controls",
    description: "See the familiar scroll view, cross-posting flow, and source-aware interaction model.",
    accent: "text-violet-300",
  },
  {
    href: "/trust",
    icon: ShieldCheck,
    title: "Trust center",
    description: "Review security posture, privacy choices, tokens, permissions, and compliance references.",
    accent: "text-cyan-300",
  },
  {
    href: "/about",
    icon: Sparkles,
    title: "Product vision",
    description: "Understand why Mesh.me exists, how Meshi fits, and how the product adapts to the user.",
    accent: "text-violet-300",
  },
  {
    href: "/privacy",
    icon: Lock,
    title: "Privacy policy",
    description: "Read the user-facing explanation of data collection, storage, export, deletion, and rights.",
    accent: "text-[var(--accent)]",
  },
  {
    href: "/terms",
    icon: BarChart3,
    title: "Terms and platform use",
    description: "Review user obligations, third-party platform boundaries, subscriptions, and legal terms.",
    accent: "text-cyan-300",
  },
];

type Route = (typeof routes)[number];

// Staggered scroll-in: the grid orchestrates each card on its own beat.
const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
};

// Springy overshoot easing shared by the icon-tile pop and the arrow slide.
const POP_EASE = "cubic-bezier(0.34,1.56,0.64,1)";

function RouteCard({ route, reduce }: { route: Route; reduce: boolean }) {
  const Icon = route.icon;
  const [hovered, setHovered] = useState(false);

  // Pointer-driven 3D tilt (±4deg) with a periwinkle cursor glow. Springs keep
  // it physical; reduced motion skips every update so the card stays flat.
  const rotateX = useSpring(0, { stiffness: 300, damping: 22, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 22, mass: 0.6 });
  const glowX = useSpring(50, { stiffness: 220, damping: 26 });
  const glowY = useSpring(50, { stiffness: 220, damping: 26 });
  const glow = useMotionTemplate`radial-gradient(220px circle at ${glowX}% ${glowY}%, rgba(110,139,255,0.20), transparent 62%)`;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 8); // horizontal → yaw, capped ±4deg
    rotateX.set((0.5 - py) * 8); // vertical → pitch, capped ±4deg
    glowX.set(px * 100);
    glowY.set(py * 100);
  };

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
    glowX.set(50);
    glowY.set(50);
    setHovered(false);
  };

  return (
    <motion.div
      variants={cardVariants}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={resetTilt}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="min-w-0"
    >
      <Link
        href={route.href}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]"
      >
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: glow }}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        />
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)] transition-transform duration-300 motion-safe:group-hover:scale-110"
            style={{ transitionTimingFunction: POP_EASE }}
          >
            <Icon className={`h-5 w-5 ${route.accent}`} />
          </div>
          <ArrowRight
            className="h-4 w-4 text-[var(--text-muted)] transition duration-300 group-hover:text-[var(--text-primary)] motion-safe:group-hover:translate-x-1"
            style={{ transitionTimingFunction: POP_EASE }}
          />
        </div>
        <h3 className="relative text-base font-semibold text-[var(--text-primary)]">{route.title}</h3>
        <p className="relative mt-2 text-sm leading-6 text-[var(--text-secondary)]">{route.description}</p>
      </Link>
    </motion.div>
  );
}

export function SiteRouteMap({
  title = "Route map",
  description = "These are the public routes that define the launch surface.",
}: {
  title?: string;
  description?: string;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <section className="grid gap-5">
      <motion.div
        className="max-w-3xl"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="mesh-kicker mb-3">Route by route</p>
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)] md:text-base">{description}</p>
      </motion.div>

      <motion.div
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        variants={gridVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {routes.map((route) => (
          <RouteCard key={route.href} route={route} reduce={reduce} />
        ))}
      </motion.div>

      <motion.div
        className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-1 h-5 w-5 text-[var(--accent)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Launch UX rule</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Every route should answer three questions quickly: where the user is, what they can do here, and what the next best path is.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
