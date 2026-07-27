"use client";

import { PaperWait } from "@/components/loading/paper-wait";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRef, useState, useTransition, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPost } from "@/lib/actions";
import { publishMeshiCause } from "@/lib/meshi-bus";
import { playSound } from "@/lib/sound";
import { Image as ImageIcon, Hash, Globe, X, Share2, ChevronDown, Info, CheckCircle2, AlertTriangle, Link as LinkIcon, Lock, Users, Video, Eye } from "lucide-react";

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
  startExpanded?: boolean;
  onPostPending?: (draft: PostDraft) => string | void;
  onPostCreated?: (post: CreatedFeedPost, optimisticId?: string) => void;
  onPostFailed?: (optimisticId?: string) => void;
}

type PostDraft = {
  content: string;
  tags: string;
  communityId?: string;
  crossPostTo: string[];
  visibility: "public" | "friends" | "private";
  media: { id: string; url: string; type: string }[];
};

type CreatedFeedPost = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  community?: { id: string; name: string; slug: string } | null;
  media: { id: string; url: string; type: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions?: { id: string }[];
  savedBy?: { id: string }[];
  isPinned?: boolean;
  platform?: string;
  optimistic?: boolean;
  isNsfw?: boolean;
  contentRating?: string;
  visibility?: string;
};

type LocalMediaPreview = {
  id: string;
  file: File;
  url: string;
  type: "image" | "video";
};

const visibilityOptions = [
  { id: "public", label: "Everyone", icon: Globe, copy: "Anyone on Mesh.me" },
  { id: "friends", label: "Friends", icon: Users, copy: "Mutual follows only" },
  { id: "private", label: "Only me", icon: Lock, copy: "Private to your account" },
] as const;

function inferComposerMediaType(url: string) {
  const clean = url.split("?")[0]?.toLowerCase() || "";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(clean)) return "image";
  return "link";
}

export function PostComposer({ user, communityId, startExpanded = false, onPostPending, onPostCreated, onPostFailed }: PostComposerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaFilesRef = useRef<LocalMediaPreview[]>([]);
  const shouldFocusComposer = searchParams.get("compose") === "true" || startExpanded;
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<(typeof visibilityOptions)[number]["id"]>("public");
  const [mediaFiles, setMediaFiles] = useState<LocalMediaPreview[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [showLinkTools, setShowLinkTools] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [showCrossPost, setShowCrossPost] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [publishableAccounts, setPublishableAccounts] = useState<string[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [expanded, setExpanded] = useState(shouldFocusComposer);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasAttachment = mediaFiles.length > 0 || mediaUrl.trim().length > 0 || linkUrl.trim().length > 0;
  const isExpanded = expanded || shouldFocusComposer || content.length > 0 || hasAttachment || showTags || showLinkTools || showVisibility || showCrossPost || selectedPlatforms.size > 0 || Boolean(errorMessage);

  useEffect(() => {
    if (!showCrossPost || accountsLoaded) return;
    const controller = new AbortController();

    async function loadAccounts() {
      setAccountsLoading(true);
      try {
        const res = await fetch("/api/connected-accounts", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const platforms = (data.accounts || [])
            .filter((a: { platform: string; isActive?: boolean }) => a.isActive !== false)
            .map((a: { platform: string }) => a.platform);
          const publishablePlatforms = (data.accounts || [])
            .filter((a: { platform: string; isActive?: boolean; capability?: { crossPost?: boolean } }) => a.isActive !== false && a.capability?.crossPost)
            .map((a: { platform: string }) => a.platform);
          setConnectedAccounts(platforms);
          setPublishableAccounts(publishablePlatforms);
        }
      } catch {
        /* ignore */
      } finally {
        if (!controller.signal.aborted) {
          setAccountsLoaded(true);
          setAccountsLoading(false);
        }
      }
    }
    void loadAccounts();

    return () => controller.abort();
  }, [accountsLoaded, showCrossPost]);

  useEffect(() => {
    if (!shouldFocusComposer) return;
    setExpanded(true);
    const focusComposer = () => {
      textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      textareaRef.current?.focus({ preventScroll: true });
    };
    const firstTimeout = window.setTimeout(focusComposer, 100);
    const secondTimeout = window.setTimeout(focusComposer, 350);
    return () => {
      window.clearTimeout(firstTimeout);
      window.clearTimeout(secondTimeout);
    };
  }, [shouldFocusComposer]);

  useEffect(() => {
    if (!successMessage && !errorMessage) return;
    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [successMessage, errorMessage]);

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  useEffect(() => {
    return () => {
      mediaFilesRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openComposer = () => {
    setExpanded(true);
    window.setTimeout(() => textareaRef.current?.focus(), 70);
  };

  const handleMediaFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next = Array.from(files)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, 4 - mediaFiles.length)
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" as const : "image" as const,
      }));
    setMediaFiles((current) => [...current, ...next].slice(0, 4));
  };

  const removeMediaFile = (id: string) => {
    setMediaFiles((current) => {
      const match = current.find((item) => item.id === id);
      if (match) URL.revokeObjectURL(match.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const handleSubmit = () => {
    if (!content.trim() && !hasAttachment) return;
    const contentValue = content.trim();
    const tagsValue = tags;
    const selectedPlatformIds = [...selectedPlatforms];
    const mediaUrlValue = mediaUrl.trim();
    const linkUrlValue = linkUrl.trim();
    const optimisticMedia = [
      ...mediaFiles.map((item) => ({ id: item.id, url: item.url, type: item.type })),
      ...(mediaUrlValue ? [{ id: `media-url-${Date.now()}`, url: mediaUrlValue, type: inferComposerMediaType(mediaUrlValue) }] : []),
      ...(linkUrlValue ? [{ id: `link-url-${Date.now()}`, url: linkUrlValue, type: "link" }] : []),
    ].slice(0, 4);
    const optimisticId = onPostPending?.({
      content: contentValue,
      tags: tagsValue,
      communityId: communityId || undefined,
      crossPostTo: selectedPlatformIds,
      visibility,
      media: optimisticMedia,
    });
    const formData = new FormData();
    formData.set("content", contentValue);
    if (tagsValue) formData.set("tags", tagsValue);
    if (communityId) formData.set("communityId", communityId);
    formData.set("visibility", visibility);
    mediaFiles.forEach((item) => formData.append("mediaFiles", item.file));
    if (mediaUrlValue) formData.append("mediaUrls", mediaUrlValue);
    if (linkUrlValue) formData.set("linkUrl", linkUrlValue);
    // Cross-post platforms (mesh.me is always the origin)
    if (selectedPlatformIds.length > 0) {
      formData.set("crossPostTo", JSON.stringify(selectedPlatformIds));
    }

    startTransition(async () => {
      setSubmitting(true);
      setSuccessMessage("Posting now...");
      setErrorMessage("");
      try {
        const result = await createPost(formData);
        if (result?.success) {
          playSound("chime");
          // Meshi celebrates AFTER the server confirmed it — publishing on
          // submit would have Meshi cheering for posts that failed.
          publishMeshiCause({ kind: "post:published" });
          const crossPostResults = result.crossPostResults ? Object.entries(result.crossPostResults) : [];
          const failedCrossPosts = crossPostResults.filter(([, value]) => !value.success);
          if (result.post) {
            onPostCreated?.(result.post, optimisticId || undefined);
            window.dispatchEvent(new CustomEvent("mesh:post-created", { detail: result.post }));
          } else {
            onPostFailed?.(optimisticId || undefined);
          }
          setContent("");
          setTags("");
          setMediaUrl("");
          setLinkUrl("");
          setMediaFiles((current) => {
            current.forEach((item) => URL.revokeObjectURL(item.url));
            return [];
          });
          setShowTags(false);
          setShowLinkTools(false);
          setShowVisibility(false);
          setSelectedPlatforms(new Set());
          setShowCrossPost(false);
          setExpanded(false);
          setSuccessMessage(
            selectedPlatformIds.length > 0
              ? failedCrossPosts.length > 0
                ? "Post created. Some platform actions need permissions."
                : "Post created and synced where supported."
              : "Post created"
          );
          if (shouldFocusComposer) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete("compose");
            const nextQuery = nextParams.toString();
            router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
          }
          window.setTimeout(() => router.refresh(), 350);
        } else {
          onPostFailed?.(optimisticId || undefined);
          setSuccessMessage("");
          setErrorMessage(result?.error || "Could not create post");
          // Meshi represents the user, and the user is not delighted that it
          // failed. A mascot that only ever reacts to success is decoration.
          publishMeshiCause({ kind: "action:failed" });
        }
      } catch {
        onPostFailed?.(optimisticId || undefined);
        setSuccessMessage("");
        setErrorMessage("Could not create post");
        publishMeshiCause({ kind: "action:failed" });
      } finally {
        setSubmitting(false);
      }
    });
  };

  const availablePlatforms = CROSS_POST_PLATFORMS.filter((p) => publishableAccounts.includes(p.id));
  const connectedButNotPublishable = CROSS_POST_PLATFORMS.filter((p) => connectedAccounts.includes(p.id) && !publishableAccounts.includes(p.id));

  return (
    // `rounded-2xl glass-card` is gone. The composer is a TRAY — the recess its
    // colour already claimed it was — and `glass-card` only pulled it into the
    // `.feed-x-layout .glass-card !important` block at globals.css:4031, which
    // is what forced the outward shadow onto a well in the first place.
    <div className="feed-composer-card p-3 sm:p-4">
      {(successMessage || errorMessage) && (
        <div className={`tray mb-3 flex items-center gap-2 px-3 py-2 text-xs font-semibold ${successMessage ? "text-[var(--success)]" : "text-[var(--danger)]"}`} role="status">
          {successMessage ? (
            isPending ? <PaperWait size="sm" /> : <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {successMessage || errorMessage}
        </div>
      )}

      {!isExpanded ? (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
          <button
            type="button"
            onClick={openComposer}
            className="feed-composer-trigger key flex min-h-11 min-w-0 flex-1 items-center px-4 text-left text-sm font-semibold text-[var(--text-muted)]"
          >
            What&apos;s happening?
          </button>
          <Button onClick={openComposer} size="sm">
            Post
          </Button>
        </div>
      ) : (
        <div className="flex min-w-0 gap-3">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
          <div className="min-w-0 flex-1">

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className="w-full bg-transparent text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[80px]"
            rows={3}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            multiple
            className="hidden"
            onChange={(event) => {
              handleMediaFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {mediaFiles.length > 0 && (
            <div className="feed-composer-media-grid mt-3">
              {mediaFiles.map((item) => (
                <div key={item.id} className="feed-composer-media-preview">
                  {item.type === "video" ? (
                    <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button type="button" onClick={() => removeMediaFile(item.id)} aria-label="Remove media" className="feed-composer-remove-media">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showLinkTools && (
            <div className="tray mt-3 grid gap-2 p-3">
              <label className="grid gap-1 text-micro font-semibold text-[var(--text-secondary)]">
                Link preview
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="theme-input min-h-10 rounded-lg px-3 text-sm"
                />
              </label>
              <label className="grid gap-1 text-micro font-semibold text-[var(--text-secondary)]">
                Image or video URL
                <input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="theme-input min-h-10 rounded-lg px-3 text-sm"
                />
              </label>
            </div>
          )}

          {/* Who can see this post was conveyed by the cobalt mould and nothing
              else. A screen reader heard three buttons, each reading out its own
              label and description, with no way to tell which one was chosen —
              an audience decision announced to no one. */}
          {showVisibility && (
            <div className="tray mt-3 grid gap-2 p-2 sm:grid-cols-3" role="group" aria-label="Who can see this post">
              {visibilityOptions.map((option) => {
                const Icon = option.icon;
                const active = visibility === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVisibility(option.id)}
                    className={`key px-3 py-2 text-left ${active ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]" : "text-[var(--text-secondary)]"}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </span>
                    {/* On the lit key the copy has to ride --mould-cobalt-ink,
                        not --text-muted: --ink-3 over cobalt is not a ratio
                        anyone has measured, and the pinned ink is. */}
                    <span className={`mt-1 block text-micro ${active ? "opacity-90" : "text-[var(--text-muted)]"}`}>{option.copy}</span>
                  </button>
                );
              })}
            </div>
          )}

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
            <div className="tray mt-3 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-micro font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
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
                      className={"key flex min-h-11 items-center gap-1.5 px-2.5 py-1.5 text-micro font-semibold " + (
                        selectedPlatforms.has(p.id)
                          ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                          : "text-[var(--text-secondary)]"
                      )}
                      aria-pressed={selectedPlatforms.has(p.id)}
                    >
                      {/* The brand hex was the button's whole fill when selected,
                          with `text-white` on top of it — #0085FF and #000000 in
                          the same list, one ink assumed for both. It is a
                          decorative swatch now, carrying no text, and SELECTED is
                          the same cobalt plastic every other selected thing on
                          this surface wears. Brand colour says which platform;
                          the plastic says which are on. */}
                      <span className="h-4 w-4 rounded" style={{ backgroundColor: p.color }} aria-hidden="true" />
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-micro text-[var(--text-muted)] flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {accountsLoading
                    ? "Checking connected platforms..."
                    : connectedButNotPublishable.length > 0
                      ? "Connected platforms are read-only until approved publishing scopes are enabled."
                      : "Connect approved publishing platforms in Settings to cross-post."}
                </p>
              )}
              <p className="text-micro text-[var(--text-muted)] mt-2 flex items-center gap-1">
                <Info className="h-2.5 w-2.5" />
                Mesh.me only posts to source platforms through official APIs with granted publishing scopes.
              </p>
            </div>
          )}

          {/* Selected platforms indicator */}
          {selectedPlatforms.size > 0 && !showCrossPost && (
            <button
              onClick={() => setShowCrossPost(true)}
              className="mt-2 flex items-center gap-1.5 text-micro text-[var(--accent-text)] hover:underline"
            >
              <Share2 className="h-3 w-3" />
              Cross-posting to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? "s" : ""}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-primary)] pt-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="key inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Add images or videos"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="key inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Add video"
              >
                <Video className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowLinkTools(!showLinkTools)}
                className={"key inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] " + (
                  showLinkTools || linkUrl || mediaUrl
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : ""
                )}
                aria-expanded={showLinkTools}
                aria-label="Add link"
                title="Add link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowTags(!showTags)}
                className="key inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-expanded={showTags}
                aria-label="Add tags"
                title="Add tags"
              >
                <Hash className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowVisibility(!showVisibility)}
                className={"key inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] " + (
                  showVisibility || visibility !== "public"
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : ""
                )}
                aria-expanded={showVisibility}
                aria-label="Post visibility"
                title="Post visibility"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowCrossPost(!showCrossPost)}
                className={"key inline-flex h-10 w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] " + (
                  showCrossPost || selectedPlatforms.size > 0
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : ""
                )}
                aria-expanded={showCrossPost}
                aria-label="Cross-post to connected platforms"
                title="Cross-post to connected platforms"
              >
                <Globe className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="hidden text-xs font-semibold text-[var(--text-muted)] sm:inline">
                {visibilityOptions.find((option) => option.id === visibility)?.label}
              </span>
              {content.length > 0 && (
                <span className={`text-xs ${content.length > 500 ? "font-semibold text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                  {content.length}/500
                </span>
              )}
              <Button
                onClick={handleSubmit}
                disabled={(!content.trim() && !hasAttachment) || content.length > 500 || isPending || submitting}
                size="sm"
              >
                {isPending || submitting ? "Posting..." : selectedPlatforms.size > 0 ? `Post to ${selectedPlatforms.size + 1}` : "Post"}
              </Button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
