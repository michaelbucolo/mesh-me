"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState, useTransition, useEffect } from "react";
import { createPost } from "@/lib/actions";
import { Image as ImageIcon, Hash, Globe, X, Share2, ChevronDown, Info } from "lucide-react";

// Connected platforms for cross-posting
const CROSS_POST_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "#E4405F", icon: "IG" },
  { id: "twitter", name: "X / Twitter", color: "#1DA1F2", icon: "X" },
  { id: "facebook", name: "Facebook", color: "#1877F2", icon: "FB" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", icon: "IN" },
  { id: "threads", name: "Threads", color: "#000000", icon: "TH" },
  { id: "bluesky", name: "Bluesky", color: "#0085FF", icon: "BS" },
  { id: "reddit", name: "Reddit", color: "#FF4500", icon: "RD" },
];

interface PostComposerProps {
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
  communityId?: string;
}

export function PostComposer({ user, communityId }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [showCrossPost, setShowCrossPost] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load connected accounts
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/connected-accounts");
        if (res.ok) {
          const data = await res.json();
          const platforms = (data.accounts || []).map((a: { platform: string }) => a.platform);
          setConnectedAccounts(platforms);
        }
      } catch { /* ignore */ }
    }
    loadAccounts();
  }, []);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    const formData = new FormData();
    formData.set("content", content);
    if (tags) formData.set("tags", tags);
    if (communityId) formData.set("communityId", communityId);
    // Cross-post platforms (mesh.me is always the origin)
    if (selectedPlatforms.size > 0) {
      formData.set("crossPostTo", JSON.stringify([...selectedPlatforms]));
    }

    startTransition(async () => {
      const result = await createPost(formData);
      if (result?.success) {
        setContent("");
        setTags("");
        setShowTags(false);
        setSelectedPlatforms(new Set());
        setShowCrossPost(false);
      }
    });
  };

  const availablePlatforms = CROSS_POST_PLATFORMS.filter((p) => connectedAccounts.includes(p.id));

  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex gap-3">
        <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className="w-full bg-transparent text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[80px]"
            rows={3}
          />

          {showTags && (
            <div className="flex items-center gap-2 mt-2">
              <Hash className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Add tags (comma separated)"
                className="flex-1 bg-transparent text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none"
              />
              <button onClick={() => { setShowTags(false); setTags(""); }} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Cross-post platform selector */}
          {showCrossPost && (
            <div className="mt-3 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Share2 className="h-3 w-3" />
                  Also post to connected platforms
                </p>
                <button onClick={() => setShowCrossPost(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {availablePlatforms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {availablePlatforms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={"flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border " + (
                        selectedPlatforms.has(p.id)
                          ? "border-transparent text-white shadow-sm"
                          : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                      )}
                      style={selectedPlatforms.has(p.id) ? { backgroundColor: p.color } : undefined}
                    >
                      <span className={"w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold " + (
                        selectedPlatforms.has(p.id) ? "bg-white/20 text-white" : "text-white"
                      )} style={!selectedPlatforms.has(p.id) ? { backgroundColor: p.color } : undefined}>
                        {p.icon}
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Connect platforms in Settings to cross-post
                </p>
              )}
              <p className="text-[9px] text-[var(--text-muted)] mt-2 flex items-center gap-1">
                <Info className="h-2.5 w-2.5" />
                Posts are published on mesh.me first, then synced to selected platforms. mesh.me retains the original.
              </p>
            </div>
          )}

          {/* Selected platforms indicator */}
          {selectedPlatforms.size > 0 && !showCrossPost && (
            <button
              onClick={() => setShowCrossPost(true)}
              className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--accent)] hover:underline"
            >
              <Share2 className="h-3 w-3" />
              Cross-posting to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? "s" : ""}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-primary)]">
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowTags(!showTags)}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowCrossPost(!showCrossPost)}
                className={"p-2 rounded-lg transition-colors " + (
                  showCrossPost || selectedPlatforms.size > 0
                    ? "text-[var(--accent)] bg-[var(--accent)]/10"
                    : "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)]"
                )}
                title="Cross-post to connected platforms"
              >
                <Globe className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {content.length > 0 && (
                <span className={`text-xs ${content.length > 500 ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                  {content.length}/500
                </span>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || content.length > 500 || isPending}
                size="sm"
                variant="gradient"
              >
                {isPending ? "Posting..." : selectedPlatforms.size > 0 ? `Post to ${selectedPlatforms.size + 1}` : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
