"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, BarChart3, Lock, MessageCircle, Rss, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { EASE_OUT, SPRING_PANEL } from "@/lib/motion";

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
    accent: "text-[var(--accent-text)]",
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
  show: { opacity: 1, y: 0, transition: SPRING_PANEL },
};

function RouteCard({ route }: { route: Route }) {
  const Icon = route.icon;

  // Calm on purpose. This card used to stack a pointer-driven 3D tilt, a
  // cursor-following glow, and an overshoot pop on both the icon tile and the
  // arrow — three flourishes announcing one link, on a public page whose job is
  // to feel like the sign-in screen. The entrance stagger stays (it reads as
  // the page composing itself); the hover is now what the rest of the product
  // does: a border and background shift, and the arrow stepping forward.
  return (
    <motion.div variants={cardVariants} className="min-w-0">
      <Link
        href={route.href}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]"
      >
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-subtle)]">
            <Icon className={`h-5 w-5 ${route.accent}`} />
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition duration-200 group-hover:text-[var(--text-primary)] motion-safe:group-hover:translate-x-1" />
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
  return (
    <section className="grid gap-5">
      <motion.div
        className="max-w-3xl"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
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
          <RouteCard key={route.href} route={route} />
        ))}
      </motion.div>

      <motion.div
        className="rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-1 h-5 w-5 text-[var(--accent-text)]" />
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
