"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers3, Settings } from "lucide-react";
import { ExploreIcon, FlowIcon, MeChatIcon, MeshIcon, ProfileIcon } from "@/components/brand/nav-icons";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface PremiumCommandCenterProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

interface QuickLink {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  spotlight?: boolean;
}

const baseLinks: QuickLink[] = [
  { label: "The Mesh", description: "Spatial identity view", href: "/mesh", icon: MeshIcon },
  { label: "Flow", description: "Your creator timeline", href: "/feed", icon: FlowIcon },
  { label: "Explore", description: "Discover people and communities", href: "/explore", icon: ExploreIcon },
  { label: "MeChat", description: "Open your messages instantly", href: "/messages", icon: MeChatIcon },
  { label: "Communities", description: "Collaborative spaces", href: "/communities", icon: Layers3 },
  { label: "Settings", description: "Control your experience", href: "/settings", icon: Settings },
];

export function PremiumCommandCenter({ open, onClose, username }: PremiumCommandCenterProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open]);

  const links = useMemo(() => {
    const allLinks: QuickLink[] = [...baseLinks, {
      label: "Profile",
      description: "View your public presence",
      href: `/profile/${username}`,
      icon: ProfileIcon,
    }];

    if (!query.trim()) return allLinks;
    const q = query.toLowerCase();

    return allLinks.filter((link) =>
      link.label.toLowerCase().includes(q) || link.description.toLowerCase().includes(q) || link.href.toLowerCase().includes(q),
    );
  }, [query, username]);

  const navigate = (href: string) => {
    router.push(href);
    onClose();
    setQuery("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Command Center" className="max-w-2xl p-0">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 p-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to pages, search workflows, open premium tools..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {links.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => navigate(link.href)}
              className={cn(
                "group rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-3 text-left transition",
                "hover:border-[var(--border-hover)] hover:bg-[var(--bg-secondary)]/60",
                link.spotlight && "border-violet-400/30 bg-violet-500/10",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[var(--bg-tertiary)]/60 p-2 text-[var(--text-secondary)]">
                    <link.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{link.label}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{link.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text-secondary)]" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
