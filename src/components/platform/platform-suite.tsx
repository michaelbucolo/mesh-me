import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  Compass,
  Mic,
  MessageCircle,
  Network,
  Paintbrush,
  Store,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LivePlatformWorkspace } from "./live-platform-workspace";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";

export type PlatformSection =
  | "mesh"
  | "feed"
  | "mechat"
  | "analytics"
  | "content"
  | "connections"
  | "notifications"
  | "super-app"
  | "settings"
  | "explore"
  | "communities"
  | "search"
  | "profile"
  | "feedback"
  | "create"
  | "pro"
  | "vault"
  | "spaces"
  | "voice"
  | "marketplace";

type SectionConfig = {
  id: PlatformSection;
  label: string;
  href: string;
  title: string;
  body: string;
  metric: string;
  status: string;
  icon: LucideIcon;
  accent: string;
};

const sections: SectionConfig[] = [
  {
    id: "mesh",
    label: "Mesh",
    href: "/mesh",
    title: "Your living map.",
    body: "Posts, people, messages, and platforms in one place.",
    metric: "14.8k items",
    status: "Account session live",
    icon: Network,
    accent: "rgba(0, 210, 255, 0.28)",
  },
  {
    id: "feed",
    label: "Feed",
    href: "/feed",
    title: "One clean feed.",
    body: "Scroll native and connected posts together.",
    metric: "8 sources",
    status: "Credit preserved",
    icon: Sparkles,
    accent: "rgba(255, 45, 120, 0.24)",
  },
  {
    id: "mechat",
    label: "MeChat",
    href: "/messages",
    title: "One inbox.",
    body: "Chats, shared posts, and group scrolling.",
    metric: "3 live rooms",
    status: "Group scroll ready",
    icon: MessageCircle,
    accent: "rgba(34, 197, 94, 0.22)",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    title: "Know what is happening.",
    body: "Growth, privacy, permissions, and exports.",
    metric: "Trust first",
    status: "Hardened",
    icon: BarChart3,
    accent: "rgba(251, 191, 36, 0.22)",
  },
  {
    id: "content",
    label: "Content",
    href: "/content-hub",
    title: "Create once.",
    body: "Post to Mesh.me and approved platforms.",
    metric: "24 drafts",
    status: "Multi-post ready",
    icon: WandSparkles,
    accent: "rgba(168, 85, 247, 0.22)",
  },
  {
    id: "connections",
    label: "Connections",
    href: "/connected-accounts",
    title: "Connect safely.",
    body: "Every source is permission-based.",
    metric: "17 OAuth connectors",
    status: "Permission based",
    icon: ShieldCheck,
    accent: "rgba(45, 212, 191, 0.22)",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    title: "Cleaner alerts.",
    body: "One place for important notifications.",
    metric: "63% calmer",
    status: "Prioritized",
    icon: Bell,
    accent: "rgba(248, 113, 113, 0.2)",
  },
  {
    id: "super-app",
    label: "Apps",
    href: "/super-app",
    title: "Replace app-hopping.",
    body: "See what Mesh.me can handle now.",
    metric: "11 app jobs",
    status: "Mapped",
    icon: Zap,
    accent: "rgba(132, 204, 22, 0.2)",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    title: "Simple controls.",
    body: "Security, privacy, Meshi, and data.",
    metric: "5 controls",
    status: "User owned",
    icon: Settings,
    accent: "rgba(148, 163, 184, 0.22)",
  },
  {
    id: "explore",
    label: "Explore",
    href: "/explore",
    title: "Explore Meshes.",
    body: "People, communities, and creators.",
    metric: "42 Meshes",
    status: "Open browsing",
    icon: Compass,
    accent: "rgba(14, 165, 233, 0.24)",
  },
  {
    id: "communities",
    label: "Communities",
    href: "/communities",
    title: "Shared spaces.",
    body: "Groups, posts, and sessions.",
    metric: "16 spaces",
    status: "Member access",
    icon: UsersRound,
    accent: "rgba(244, 114, 182, 0.2)",
  },
  {
    id: "search",
    label: "Search",
    href: "/search",
    title: "Search everything.",
    body: "Posts, people, messages, and settings.",
    metric: "Unified index",
    status: "Ready",
    icon: Search,
    accent: "rgba(96, 165, 250, 0.24)",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    title: "Your identity.",
    body: "Meshi, profile, links, and visibility.",
    metric: "1 identity",
    status: "Portable",
    icon: UserRound,
    accent: "rgba(52, 211, 153, 0.2)",
  },
  {
    id: "feedback",
    label: "Feedback",
    href: "/feedback",
    title: "Tell us what is off.",
    body: "Bugs, requests, and trust feedback.",
    metric: "4 queues",
    status: "Open",
    icon: Paintbrush,
    accent: "rgba(251, 146, 60, 0.2)",
  },
  {
    id: "create",
    label: "Create",
    href: "/innovation",
    title: "Make something.",
    body: "Draft, post, and cross-post.",
    metric: "6 formats",
    status: "Composer ready",
    icon: WandSparkles,
    accent: "rgba(217, 70, 239, 0.22)",
  },
  {
    id: "pro",
    label: "Pro",
    href: "/meshpro",
    title: "More control.",
    body: "Customization and deeper analytics.",
    metric: "$4.99 / month",
    status: "Optional",
    icon: Sparkles,
    accent: "rgba(250, 204, 21, 0.2)",
  },
  {
    id: "vault",
    label: "Vault",
    href: "/vault",
    title: "Save what matters.",
    body: "A private archive for important moments.",
    metric: "Private archive",
    status: "User controlled",
    icon: Archive,
    accent: "rgba(56, 189, 248, 0.2)",
  },
  {
    id: "spaces",
    label: "Spaces",
    href: "/spaces",
    title: "Build together.",
    body: "Shared Mesh spaces for groups.",
    metric: "Group Meshes",
    status: "Collaborative",
    icon: UsersRound,
    accent: "rgba(45, 212, 191, 0.2)",
  },
  {
    id: "voice",
    label: "Meshi Voice",
    href: "/meshi-voice",
    title: "Talk to Meshi.",
    body: "Hands-free search and help.",
    metric: "Hands-free",
    status: "Meshi only",
    icon: Mic,
    accent: "rgba(244, 114, 182, 0.2)",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    href: "/marketplace",
    title: "Creator value.",
    body: "Accessories, themes, and creator packs.",
    metric: "No ads",
    status: "Pro aligned",
    icon: Store,
    accent: "rgba(251, 191, 36, 0.2)",
  },
];

const platformRows = [
  ["YouTube", "Videos, comments, likes", "Like sync available"],
  ["Instagram", "Posts, reels, shares", "Source credit preserved"],
  ["X", "Posts, replies, likes", "Two-way actions where approved"],
  ["Threads", "Threads and replies", "OAuth ready"],
  ["Discord", "Servers and shared links", "MeChat bridge"],
  ["Facebook", "Groups and family posts", "Classic mode friendly"],
  ["SoundCloud", "Tracks and playlists", "PKCE OAuth"],
  ["Patreon", "Creator posts and members", "OAuth ready"],
  ["Dribbble", "Shots and profile", "OAuth ready"],
];

const workspaceRows: Record<PlatformSection, string[][]> = {
  mesh: [
    ["Identity map", "14.8k nodes", "Private until shared"],
    ["Relationships", "2.1k links", "Source aware"],
    ["Meshi presence", "Live", "Moves with the user"],
  ],
  feed: [
    ["YouTube", "Designing a calmer internet", "18.4k views"],
    ["Instagram", "Meshi customization drop", "913 saves"],
    ["X", "Privacy-first social should be default", "2.7k likes"],
  ],
  mechat: [
    ["Creator pod", "Instagram + Discord", "Group scroll live"],
    ["Family scroll", "Facebook + YouTube", "Classic mode"],
    ["Launch team", "Mesh.me native", "Secure thread"],
  ],
  analytics: [
    ["Reach", "1.84M", "+18%"],
    ["Synced actions", "392k", "+31%"],
    ["Message recovery", "96%", "+22%"],
    ["Private default", "100%", "Locked"],
  ],
  content: [
    ["Text post", "Ready", "Mesh + sources"],
    ["Short video", "Drafting", "Rights checked"],
    ["Community post", "Scheduled", "Source credit on"],
  ],
  connections: platformRows,
  notifications: [
    ["Mentions", "18", "High priority"],
    ["Creator replies", "42", "Grouped"],
    ["Sync issues", "3", "Needs review"],
    ["Security", "0", "Clear"],
  ],
  "super-app": [
    ["Social feed", "Covered", "Mesh + Feed"],
    ["Messaging", "Covered", "MeChat"],
    ["Group watching", "Covered", "Shared sessions"],
    ["Native posting", "Permission dependent", "Source APIs"],
    ["Notifications", "Covered", "Hub mode"],
  ],
  settings: [
    ["Privacy first", "On", "Imports need approval"],
    ["Security first", "On", "Sessions protected"],
    ["Data export", "Ready", "Download records"],
    ["Delete paths", "Ready", "Source rules shown"],
    ["No ad model", "Locked", "Mesh Pro funds growth"],
  ],
  explore: [
    ["Creator Co-op", "Cross-posting", "Open"],
    ["Family Internet", "Classic layout", "Simple"],
    ["Privacy Lab", "Data rights", "Trusted"],
  ],
  communities: [
    ["Creator Co-op", "Cross-posting", "Open"],
    ["Family Internet", "Classic layout", "Simple"],
    ["Privacy Lab", "Data rights", "Trusted"],
  ],
  search: [
    ["Posts", "1,254", "Indexed"],
    ["People", "842", "Connected"],
    ["Messages", "3,812", "Private"],
    ["Permissions", "31", "Reviewable"],
  ],
  profile: [
    ["Meshi", "Two eyes, no mouth", "Customizable"],
    ["Connected profiles", "8", "Portable"],
    ["Public Mesh", "Selective", "User controlled"],
  ],
  feedback: [
    ["Bug", "Broken or confusing behavior", "Product queue"],
    ["Request", "New app coverage", "Roadmap"],
    ["Trust", "Privacy or security concern", "Review first"],
  ],
  create: [
    ["Draft", "Write once", "Choose destinations"],
    ["Manage", "Edit supported content", "Keep source rules"],
    ["Archive", "Clean old items", "Export first"],
  ],
  pro: [
    ["Creator analytics", "Audience overlap", "Unlocked"],
    ["Mesh customization", "Branch colors", "Unlocked"],
    ["Meshi cosmetics", "Hats and hair", "Unlocked"],
  ],
  vault: [
    ["Saved memories", "Posts and messages", "Private"],
    ["Creator references", "Videos and links", "Searchable"],
    ["Export package", "User-owned archive", "Ready"],
  ],
  spaces: [
    ["Family space", "Shared memories", "Private"],
    ["Creator team", "Launch content", "Collaborative"],
    ["Friend group", "Shared scrolling", "Live"],
  ],
  voice: [
    ["Ask Meshi", "Search my Mesh", "Private"],
    ["Hands-free analytics", "Read me this week", "Local-first"],
    ["Message action", "Draft a reply", "User approved"],
  ],
  marketplace: [
    ["Meshi accessories", "Hats and hair", "Pro"],
    ["Mesh themes", "Branch styles", "Optional"],
    ["Creator packs", "Templates and media", "Source aware"],
  ],
};

function getSection(section: PlatformSection) {
  return sections.find((item) => item.id === section) ?? sections[0];
}

function MeshPreview({ active }: { active: SectionConfig }) {
  const Icon = active.icon;

  return (
    <div className="mesh-surface relative min-h-[15rem] overflow-hidden rounded-lg p-3 sm:min-h-[18rem] sm:p-4 lg:min-h-[22rem]">
      <div className="absolute inset-0 mesh-soft-grid opacity-60" aria-hidden="true" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 360" aria-hidden="true">
        <path className="mesh-trace" d="M300 180 C160 72 90 120 70 260" fill="none" stroke="rgba(155,232,255,0.68)" strokeWidth="2" />
        <path className="mesh-trace" d="M300 180 C430 60 520 92 540 190" fill="none" stroke="rgba(255,154,192,0.6)" strokeWidth="2" />
        <path className="mesh-trace" d="M300 180 C430 295 365 320 250 325" fill="none" stroke="rgba(184,247,212,0.58)" strokeWidth="2" />
      </svg>

      <div className="relative z-10 flex h-full min-h-[13rem] flex-col justify-between sm:min-h-[16rem] lg:min-h-[20rem]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MeshiMascot size={42} color="blue" mood="happy" showGlow={false} animate bouncy />
            <div>
              <p className="text-sm font-bold">Meshi</p>
              <p className="text-xs text-[var(--text-muted)]">Your identity</p>
            </div>
          </div>
          <div className="flex max-w-[9rem] items-center gap-2 truncate rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] sm:max-w-none">
            <span className="mesh-live-dot" aria-hidden="true" />
            <span className="truncate">{active.status}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/72 p-3 text-left shadow-[var(--shadow-sm)] lg:mx-auto lg:flex-col lg:bg-transparent lg:text-center lg:shadow-none">
          <div className="mesh-glow-border flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-secondary)] lg:h-20 lg:w-20" style={{ boxShadow: `0 18px 70px ${active.accent}` }}>
            <Icon className="h-7 w-7 sm:h-[34px] sm:w-[34px]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold lg:mt-4 lg:text-lg">{active.label} is ready.</p>
            <p className="mt-1 truncate text-xs font-semibold text-[var(--text-muted)] lg:hidden">{active.metric}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Workspace({ section }: { section: PlatformSection }) {
  return <LivePlatformWorkspace section={section} fallbackRows={workspaceRows[section]} />;
}

export async function PlatformSuite({ section, afterWorkspace }: { section: PlatformSection; afterWorkspace?: ReactNode }) {
  const user = await getCurrentUserRedirectState();

  if (!user) {
    redirect("/login");
  }

  if (!user.onboarded) {
    redirect("/onboarding");
  }

  const active = getSection(section);
  const ActiveIcon = active.icon;

  return (
    <main className="platform-suite mesh-aurora min-h-full overflow-hidden rounded-lg text-[var(--text-primary)]">
      <div className="platform-suite-inner mx-auto grid max-w-[88rem] gap-4 px-2 py-2 sm:px-3 sm:py-4 md:px-4 lg:px-5 lg:py-6 xl:px-6">
        <header className="mesh-surface mesh-pop-in rounded-lg p-3 sm:p-4 lg:p-6 xl:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <MeshiBrandLockup size={34} label="Mesh.me" subtitle="Meshi represents you" useUserMeshi className="text-left" />
            </div>
          </div>

          <div className="mt-4 sm:mt-6 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/64 px-3 py-1.5 text-xs text-[var(--text-secondary)] sm:py-2 sm:text-sm">
                <ActiveIcon size={15} aria-hidden="true" />
                {active.label}
              </div>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-[1.02] tracking-[0] sm:mt-4 sm:text-4xl lg:text-5xl">{active.title}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:mt-3 sm:text-base sm:leading-7">{active.body}</p>
            </div>
            <div className="mt-5 hidden min-w-[17rem] grid-cols-2 gap-2 lg:grid">
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/58 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Status</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{active.status}</p>
              </div>
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/58 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Signal</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{active.metric}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:gap-5">
          <section className="grid gap-4 lg:gap-5 xl:grid-cols-[minmax(20rem,0.86fr)_minmax(0,1.14fr)] xl:items-start">
            <div className="xl:sticky xl:top-7">
              <MeshPreview active={active} />
            </div>

            <div className="grid gap-4 lg:gap-5">
              <div className="mesh-surface mesh-pop-in mesh-delay-1 rounded-lg p-3 sm:p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Workspace</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Private. Permission-based.</p>
                  </div>
                  <Link href={active.href} className="mesh-action mesh-action-secondary mesh-pressable w-full px-3 text-sm sm:w-auto">
                    Open {active.label}
                  </Link>
                </div>
                <div className="mt-4">
                  <Workspace section={section} />
                </div>
              </div>
            </div>
            {afterWorkspace && <div className="xl:col-span-2">{afterWorkspace}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
